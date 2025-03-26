import os
import time
import json
import urllib.parse
import pandas as pd

from django.db import transaction
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from celery import shared_task
from celery.utils.log import get_task_logger

from ..aps_toolkit import Auth, Bucket, Derivative, SVFReader, DbReader
from ..services import get_aps_urn, get_conversion_version
from .. import models

logger = get_task_logger(__name__)


@shared_task
def bim_data_import(client_id, client_secret, bucket_key, file_name, group_name, is_reload=False):
    def send_progress(status, message):
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            group_name, {
                'type': 'progress.message',
                'name': file_name,
                'status': status,
                'message': message
            },
        )

    try:
        auth = Auth(client_id, client_secret)
        token = auth.auth2leg()
        bucket = Bucket(token)

        if not is_reload:
            send_progress('upload-object', 'Uploading file to Autodesk OSS...')
            object_data = bucket.upload_object(bucket_key, f'media-root/uploads/{file_name}', file_name)
            urn = get_aps_urn(object_data['objectId'])
        else:
            send_progress('reload-object', 'Reloading existing object from bucket...')
            objects = json.loads(bucket.get_objects(bucket_key, 100).to_json(orient='records'))
            object_data = next((item for item in objects if item['objectKey'] == file_name), None)
            if not object_data:
                raise Exception("Object not found in bucket.")
            urn = get_aps_urn(object_data['objectId'])

        process_translation(urn, token, file_name, object_data, send_progress)
        return {"status": "BIM data import completed.", "file": file_name}
    except Exception as e:
        logger.error(str(e))
        send_progress('error', str(e))
        return {"status": f"BIM data import failed: {str(e)}", "file": file_name}


def process_translation(urn, token, file_name, object_data, send_progress):
    # Step 2: Trigger Translation
    send_progress('translate-job', 'Triggering translation job...')
    derivative = Derivative(urn, token)
    translate_job_ret = json.loads(derivative.translate_job())
    if 'errorCode' in translate_job_ret:
        raise Exception(translate_job_ret['developerMessage'])

    # Step 3: Monitor Translation Status
    send_progress('translate-job', 'Monitoring translation status...')
    while True:
        status = derivative.check_job_status()
        progress = status.get("progress", "unknown")
        send_progress('translate-job', f'Translation progress: {progress}')
        if progress == "complete":
            send_progress('translate-job', 'Translation complete.')
            break
        elif progress == "failed":
            raise Exception("Translation failed.")
        time.sleep(1)

    # Step 4: Download SVF
    send_progress('download-svf', 'Downloading SVF to server...')
    svf_reader = SVFReader(urn, token, "US")
    download_dir = f"media-root/svf/{file_name}"
    os.makedirs(download_dir, exist_ok=True)
    manifests = svf_reader.read_svf_manifest_items()
    if manifests:
        svf_reader.download(download_dir, manifests[0], send_progress)
        send_progress('download-svf', 'SVF download completed.')
    else:
        raise Exception("No manifest items found for download.")

    # Step 5: Download SQLite
    send_progress('download-sqlite', 'Downloading SQLite to server...')
    db = DbReader(urn, token, object_data['objectKey'])
    sqlite_path = f"{download_dir}/{file_name}.sqlite"

    # Step 6: Process SQLite Data
    group_types = models.BimGroup.objects.filter(is_active=True).prefetch_related(
        'types').values('types__display_name', 'types__value')
    if not group_types:
        raise Exception("No active BimGroup types found.")

    display_names = [gt['types__display_name'] for gt in group_types]
    value_conditions = {gt['types__display_name']: gt['types__value'] for gt in group_types if gt['types__value']}
    display_names_str = ','.join([f"'{d}'" for d in display_names])
    where_clause = f"attrs.display_name IN ({display_names_str})"
    if value_conditions:
        value_clauses = [f"(attrs.display_name = '{d}' AND vals.value = '{v}')" for d, v in value_conditions.items()]
        where_clause = f"({where_clause}) AND ({' OR '.join(value_clauses)})"
    where_clause = where_clause if display_names else "1=0"
    send_progress('where_clause', where_clause)

    # Extract BimCategory
    send_progress('extract-bimcategory', 'Extracting BimCategory from SQLite...')
    query = f"""
        SELECT DISTINCT attrs.display_name AS display_name, vals.value AS value
        FROM _objects_eav eav
        JOIN _objects_attr attrs ON attrs.id = eav.attribute_id
        JOIN _objects_val vals ON vals.id = eav.value_id
        WHERE {where_clause}
    """
    df = db.execute_query(query)
    send_progress('extract-bimcategory', f'Extracted {len(df)} BimCategory records.')

    with transaction.atomic():
        send_progress('process-bimcategory', 'Processing BimCategory records...')
        for i, row in enumerate(df.itertuples(), 1):
            group = models.BimGroup.objects.filter(types__display_name=row.display_name).first()
            if group:
                models.BimCategory.objects.update_or_create(
                    bim_group=group,
                    value=row.value,
                    defaults={'display_name': row.display_name}
                )
            if i % 100 == 0:
                send_progress('process-bimcategory', f'Processed {i}/{len(df)} BimCategory records.')
        send_progress('process-bimcategory', 'BimCategory processing completed.')

        # Create BimModel and BimConversion
        send_progress('process-model-conversion', 'Creating BimModel and BimConversion...')
        bim_model, _ = models.BimModel.objects.get_or_create(name=file_name)
        version = bim_model.bim_conversions.count() + 1
        bim_conversion = models.BimConversion.objects.create(
            bim_model=bim_model,
            urn=urn,
            version=version,
            original_file=f"media-root/uploads/{file_name}",
            svf_file=f"media-root/svf/{file_name}"
        )
        send_progress('process-model-conversion', f'BimModel {bim_model.name} (v{version}) created.')

        # Extract BimObject and Category data from SQLite
        send_progress('extract-bimobject', 'Extracting BimObject and Category data from SQLite...')
        query = f"""
            WITH filtered_eav AS (
                SELECT eav.entity_id, attrs.display_name, vals.value
                FROM _objects_eav eav
                JOIN _objects_attr attrs ON attrs.id = eav.attribute_id
                JOIN _objects_val vals ON vals.id = eav.value_id
                WHERE {where_clause}
            )
            SELECT DISTINCT 
                eav.entity_id AS dbid,
                name_vals.value AS value,
                cat.display_name AS category_display_name,
                cat.value AS category_value
            FROM _objects_eav eav
            JOIN _objects_attr name_attrs ON name_attrs.id = eav.attribute_id AND name_attrs.category = '__name__'
            JOIN _objects_val name_vals ON name_vals.id = eav.value_id
            LEFT JOIN filtered_eav cat ON cat.entity_id = eav.entity_id
            WHERE eav.entity_id IN (
                SELECT entity_id FROM filtered_eav
            )
            GROUP BY eav.entity_id, name_vals.value, cat.display_name, cat.value
        """
        obj_df = db.execute_query(query)
        send_progress('extract-bimobject', f'Extracted {len(obj_df)} BimObject records with category info.')

        # 預載 BimCategory 映射
        bim_categories = {cat.value: cat for cat in models.BimCategory.objects.filter(bim_group__is_active=True)}

        # 在 DataFrame 中處理資料
        send_progress('process-bimobject', 'Processing BimObject records in DataFrame...')
        obj_df['category'] = obj_df.apply(
            lambda row: bim_categories.get(
                row['category_value']) if row['category_display_name'] in display_names and row['category_value'] in bim_categories else None,
            axis=1
        )
        obj_df = obj_df[obj_df['category'].notnull()].copy()  # 只保留有效 category

        # 構建 BimObject 物件
        bim_objects = [
            models.BimObject(
                category=row['category'],
                conversion=bim_conversion,
                dbid=row['dbid'],
                value=row['value']
            ) for _, row in obj_df.iterrows()
        ]
        send_progress('process-bimobject', f'Processed {len(bim_objects)} valid BimObject records.')

        # 批量寫入
        send_progress('process-bimobject', 'Inserting BimObject records into database...')
        models.BimObject.objects.bulk_create(bim_objects)
        send_progress('process-bimobject', f'BimObject processing completed: {len(bim_objects)} records inserted.')

        send_progress('complete', 'BIM data import completed.')


'''
SQLite相關語法

1.
-- SELECT _objects_id.id, _objects_id.external_id,_objects_attr.name,_objects_attr.category,_objects_attr.display_name, _objects_val.value

-- select distinct value
-- select distinct display_name

SELECT DISTINCT display_name, value
FROM _objects_id
JOIN _objects_eav ON _objects_id.id = _objects_eav.entity_id
JOIN _objects_attr ON _objects_eav.attribute_id = _objects_attr.id
JOIN _objects_val ON _objects_eav.value_id = _objects_val.id
WHERE display_name IN ('COBie.Floor.Name', 'COBie.Space.Name', 'COBie.Space.RoomTag', 'COBie.Type.Category', 'COBie.Type.Manufacturer', 'Cobie.Type.ModelNumber', 'COBie.Type.WarrantyGuarantorLabor')
--where display_name like '%Type%' -- and value='房間'
-- WHERE display_name like '%COBie%' 
-- where  _objects_id.id=13803

2.
SELECT 
	ids.id AS entity_id,
    ids.external_id AS entity_external_id,
    ids.viewable_id AS entity_viewable_id,
    eav.id AS eav_id,
    eav.entity_id AS eav_entity_id,
    eav.attribute_id AS eav_attribute_id,
    eav.value_id AS eav_value_id,    
    attrs.id AS attr_id,
    attrs.name AS attr_name,
    attrs.category AS attr_category,
    attrs.data_type AS attr_data_type,
    attrs.data_type_context AS attr_data_type_context,
    attrs.description AS attr_description,
    attrs.display_name AS attr_display_name,
    attrs.flags AS attr_flags,
    attrs.display_precision AS attr_display_precision,
    attrs.forge_parameter AS attr_forge_parameter,
    vals.id AS val_id,
    vals.value AS val_value
FROM _objects_eav eav
LEFT JOIN _objects_id ids ON ids.id = eav.entity_id
LEFT JOIN _objects_attr attrs ON attrs.id = eav.attribute_id
LEFT JOIN _objects_val vals ON vals.id = eav.value_id
-- where  val_value='A06_B1F'
WHERE attrs.display_name IN ('COBie.Floor.Name','COBie.Space.Name','COBie.Space.RoomTag','COBie.Type.Name','COBie.Type.Category','COBie.Type.Manufacturer','Cobie.Type.ModelNumber','COBie.Type.WarrantyGuarantorLabor')
and value='(02)26553456'
-- and val_value='A06_B1F'
-- where entity_id=13808

3.
-- SELECT _objects_id.id, _objects_id.external_id,_objects_attr.name,_objects_attr.category,_objects_attr.display_name, _objects_val.value

-- select distinct value
-- select distinct display_name

SELECT DISTINCT display_name, value
FROM _objects_id
JOIN _objects_eav ON _objects_id.id = _objects_eav.entity_id
JOIN _objects_attr ON _objects_eav.attribute_id = _objects_attr.id
JOIN _objects_val ON _objects_eav.value_id = _objects_val.id
WHERE display_name IN ('COBie.Floor.Name', 'COBie.Space.Name', 'COBie.Space.RoomTag', 'COBie.Type.Category', 'COBie.Type.Manufacturer', 'Cobie.Type.ModelNumber', 'COBie.Type.WarrantyGuarantorLabor')
and value='(02)26553456'
--where display_name like '%Type%' -- and value='房間'
-- WHERE display_name like '%COBie%' 
-- where  _objects_id.id=13803

4.
SELECT DISTINCT 
                eav.entity_id AS dbid, 
                name_vals.value AS value,
                parent_vals.value AS parent,
                GROUP_CONCAT(child_vals.value) AS child,
                CASE WHEN EXISTS (
                    SELECT 1 FROM _objects_eav eav2
                    JOIN _objects_attr attrs2 ON attrs2.id = eav2.attribute_id
                    WHERE eav2.entity_id = eav.entity_id AND attrs2.category = '__child__'
                ) THEN 0 ELSE 1 END AS is_leaf,
                parent_name_vals.value AS parent_name
            FROM _objects_eav eav
            JOIN _objects_attr name_attrs ON name_attrs.id = eav.attribute_id AND name_attrs.category = '__name__'
            JOIN _objects_val name_vals ON name_vals.id = eav.value_id
            LEFT JOIN _objects_eav parent_eav ON parent_eav.entity_id = eav.entity_id
                AND parent_eav.attribute_id = (SELECT id FROM _objects_attr WHERE category = '__parent__')
            LEFT JOIN _objects_val parent_vals ON parent_vals.id = parent_eav.value_id
            LEFT JOIN _objects_eav child_eav ON child_eav.entity_id = eav.entity_id
                AND child_eav.attribute_id = (SELECT id FROM _objects_attr WHERE category = '__child__')
            LEFT JOIN _objects_val child_vals ON child_vals.id = child_eav.value_id
            LEFT JOIN _objects_eav parent_name_eav ON parent_name_eav.entity_id = parent_vals.value
                AND parent_name_eav.attribute_id = (SELECT id FROM _objects_attr WHERE category = '__name__')
            LEFT JOIN _objects_val parent_name_vals ON parent_name_vals.id = parent_name_eav.value_id
            WHERE eav.entity_id IN (
                SELECT eav.entity_id
                FROM _objects_eav eav
                JOIN _objects_attr attrs ON attrs.id = eav.attribute_id
                JOIN _objects_val vals ON vals.id = eav.value_id
                WHERE attrs.display_name IN ('COBie.Floor.Name','COBie.Space.Name','COBie.Space.RoomTag','COBie.Type.Name','COBie.Type.Category','COBie.Type.Manufacturer','Cobie.Type.ModelNumber','COBie.Type.WarrantyGuarantorLabor')
				and vals.value='(02)26553456'
            )
			
            GROUP BY eav.entity_id, name_vals.value, parent_vals.value, parent_name_vals.value
'''

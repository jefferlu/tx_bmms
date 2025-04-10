import os
import time
import json
import sqlite3
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

        result = process_translation(urn, token, file_name, object_data, send_progress)
        return {"status": "BIM data import completed.", "file": file_name, **result}
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
    sqlite_path = db.db_path
    send_progress('download-sqlite', 'SQLite download completed.')

    # Step 6: Create or Update BimModel and Process Data
    send_progress('process-model-conversion', 'Creating or updating BimModel...')
    with transaction.atomic():
        # 從 file_name 提取 zone（第3組）和 level（第4組）
        parts = file_name.split('-')
        zone = parts[2].upper()
        level = parts[3].upper()
        zone_code = models.ZoneCode.objects.get(code=zone)
        level_code = models.LevelCode.objects.get(code=level)

        bim_model, created = models.BimModel.objects.get_or_create(
            name=file_name,
            defaults={'urn': urn, 'version': 1, 'zone_code': zone_code, 'level_code': level_code}
        )
        if not created:
            bim_model.urn = urn
            bim_model.version += 1
            bim_model.zone_code = zone_code
            bim_model.level_code = level_code
            bim_model.save()
        send_progress('process-model-conversion', f'BimModel {bim_model.name} (v{bim_model.version}) updated.')

        result = _process_categories_and_objects(
            sqlite_path=sqlite_path,
            bim_model_id=bim_model.id,
            file_name=file_name,
            send_progress=send_progress
        )
        send_progress('complete', f'BIM data import completed (v{bim_model.version}).')

    return result


@shared_task
def bim_update_categories(sqlite_path, bim_model_id, file_name, group_name, send_progress=None):
    def default_send_progress(status, message):
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            group_name, {
                'type': 'update.category',
                'name': file_name,
                'status': status,
                'message': message
            },
        )
    send_progress = send_progress or default_send_progress

    try:
        result = _process_categories_and_objects(
            sqlite_path=sqlite_path,
            bim_model_id=bim_model_id,
            file_name=file_name,
            send_progress=send_progress
        )
        send_progress('complete', f'BIM data update completed.')
        return result
    except Exception as e:
        logger.error(f"Error updating Bim data: {str(e)}")
        send_progress('error', f"Error updating Bim data: {str(e)}")
        raise


def _process_categories_and_objects(sqlite_path, bim_model_id, file_name, send_progress):
    bim_model = models.BimModel.objects.get(id=bim_model_id)

    # Step 1: 獲取當前 BimGroup 條件
    group_types = models.BimGroup.objects.filter(is_active=True).prefetch_related(
        'types').values('types__display_name', 'types__value')
    if not group_types:
        send_progress('error', "No active BimGroup types found.")
        raise Exception("No active BimGroup types found.")

    display_names = set(gt['types__display_name'] for gt in group_types)
    value_conditions = {gt['types__display_name']: gt['types__value'] for gt in group_types if gt['types__value']}
    display_names_str = ','.join([f"'{d}'" for d in display_names])
    where_clause = f"attrs.display_name IN ({display_names_str})"
    if value_conditions:
        value_clauses = [
            f"(attrs.display_name = '{d}' AND CAST(vals.value AS TEXT) = '{v}')" for d, v in value_conditions.items()]
        where_clause = f"({where_clause}) AND ({' OR '.join(value_clauses)})"

    # Step 2: 從 SQLite 提取新資料
    send_progress('extract-bimcategory', 'Extracting BimCategory from SQLite...')
    conn = sqlite3.connect(sqlite_path)
    category_query = f"""
        SELECT DISTINCT attrs.display_name AS display_name, CAST(vals.value AS TEXT) AS value
        FROM _objects_eav eav
        JOIN _objects_attr attrs ON attrs.id = eav.attribute_id
        JOIN _objects_val vals ON vals.id = eav.value_id
        WHERE {where_clause}
        ORDER BY display_name
    """
    df_categories = pd.read_sql_query(category_query, conn)
    send_progress('extract-bimcategory', f'Extracted {len(df_categories)} BimCategory records.')

    # Step 3: 提取 BimObject 資料
    send_progress('extract-bimobject', 'Extracting BimObject from SQLite...')
    object_query = f"""
        WITH filtered_entities AS (
            SELECT DISTINCT eav.entity_id
            FROM _objects_eav eav
            JOIN _objects_attr attrs ON attrs.id = eav.attribute_id
            WHERE {where_clause} OR attrs.category = '__name__'
        ),
        name_data AS (
            SELECT eav2.entity_id, CAST(vals2.value AS TEXT) AS primary_value
            FROM _objects_eav eav2
            JOIN _objects_attr attrs2 ON attrs2.id = eav2.attribute_id
            JOIN _objects_val vals2 ON vals2.id = eav2.value_id
            WHERE attrs2.category = '__name__'
        )
        SELECT 
            eav.entity_id AS dbid,
            name_data.primary_value AS primary_value,
            attrs.display_name AS display_name,
            CAST(vals.value AS TEXT) AS value
        FROM _objects_eav eav
        JOIN _objects_attr attrs ON attrs.id = eav.attribute_id
        JOIN _objects_val vals ON vals.id = eav.value_id
        JOIN filtered_entities fe ON fe.entity_id = eav.entity_id
        JOIN name_data ON name_data.entity_id = eav.entity_id
        WHERE {where_clause}
    """
    df_objects = pd.read_sql_query(object_query, conn)
    conn.close()
    send_progress('extract-bimobject', f'Extracted {len(df_objects)} BimObject records.')

    # Step 4: 處理 BimCategory 和 BimObject（增量更新）
    with transaction.atomic():
        # 獲取現有 BimCategory 和 BimObject
        existing_categories = {
            (c.display_name, c.value): c
            for c in models.BimCategory.objects.filter(bim_model=bim_model)
        }
        existing_objects = {
            (o.dbid, o.display_name, o.value): o
            for o in models.BimObject.objects.filter(category__bim_model=bim_model)
        }

        # 定義新資料的有效條件
        valid_category_pairs = set((row.display_name, row.value) for _, row in df_categories.iterrows())
        valid_display_names = set(display_names)

        # 清理不再符合條件的 BimCategory 和相關 BimObject
        send_progress('cleanup-bimcategory', 'Cleaning up outdated BimCategory and BimObject records...')
        to_delete_categories = [
            cat for (disp_name, val), cat in existing_categories.items()
            if disp_name not in valid_display_names or (disp_name, val) not in valid_category_pairs
        ]
        if to_delete_categories:
            to_delete_ids = [cat.id for cat in to_delete_categories]
            # 先批量刪除相關 BimObject
            deleted_objects_count = models.BimObject.objects.filter(category_id__in=to_delete_ids).delete()[0]
            # 再批量刪除 BimCategory
            deleted_categories_count = models.BimCategory.objects.filter(id__in=to_delete_ids).delete()[0]
            send_progress('cleanup-bimcategory',
                          f'Deleted {deleted_categories_count} outdated BimCategory and {deleted_objects_count} BimObject records.')
        else:
            send_progress('cleanup-bimcategory', 'No outdated BimCategory records to delete.')

        # 增量更新 BimCategory
        send_progress('process-bimcategory', 'Processing BimCategory records...')
        new_categories = {}
        for i, row in enumerate(df_categories.itertuples(), 1):
            key = (row.display_name, row.value)
            if key not in existing_categories:
                group = models.BimGroup.objects.filter(types__display_name=row.display_name).first()
                if group:
                    category = models.BimCategory.objects.create(
                        bim_group=group,
                        bim_model=bim_model,
                        value=row.value,
                        display_name=row.display_name
                    )
                    new_categories[key] = category
            if i % 100 == 0:
                send_progress('process-bimcategory', f'Processed {i}/{len(df_categories)} BimCategory records.')
        send_progress('process-bimcategory', f'BimCategory processing completed: {len(new_categories)} new records.')

        # 增量更新 BimObject
        send_progress('process-bimobject', 'Processing BimObject records...')
        bim_objects = []
        for i, row in enumerate(df_objects.itertuples(), 1):
            category = new_categories.get((row.display_name, row.value)) or existing_categories.get((row.display_name, row.value))
            if category:
                key = (row.dbid, row.display_name, row.value)
                if key not in existing_objects:
                    bim_objects.append(
                        models.BimObject(
                            category=category,
                            dbid=row.dbid,
                            primary_value=row.primary_value,
                            display_name=row.display_name,
                            value=row.value
                        )
                    )
            if i % 1000 == 0:
                send_progress('process-bimobject', f'Processed {i}/{len(df_objects)} BimObject records.')

        # 批量創建新 BimObject
        models.BimObject.objects.bulk_create(bim_objects)
        send_progress('process-bimobject', f'BimObject processing completed: {len(bim_objects)} new records inserted.')

    return {"categories_count": len(new_categories), "objects_count": len(bim_objects)}

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
        value_clauses = [
            f"(attrs.display_name = '{d}' AND CAST(vals.value AS TEXT) = '{v}')" for d, v in value_conditions.items()]
        where_clause = f"({where_clause}) AND ({' OR '.join(value_clauses)})"
    where_clause = where_clause if display_names else "1=0"

    # Extract BimCategory
    send_progress('extract-bimcategory', 'Extracting BimCategory from SQLite...')
    category_query = f"""
        SELECT DISTINCT attrs.display_name AS display_name, CAST(vals.value AS TEXT) AS value
        FROM _objects_eav eav
        JOIN _objects_attr attrs ON attrs.id = eav.attribute_id
        JOIN _objects_val vals ON vals.id = eav.value_id
        WHERE {where_clause}
        ORDER BY display_name
    """
    df_categories = db.execute_query(category_query)
    send_progress('extract-bimcategory', f'Extracted {len(df_categories)} BimCategory records.')

    with transaction.atomic():
        # Create or Update BimModel
        send_progress('process-model-conversion', 'Creating or updating BimModel...')
        bim_model, created = models.BimModel.objects.get_or_create(
            name=file_name,
            defaults={'urn': urn, 'version': 1}
        )
        if not created:
            bim_model.urn = urn
            bim_model.version += 1
            bim_model.save()
        send_progress('process-model-conversion', f'BimModel {bim_model.name} (v{bim_model.version}) updated.')

        # Process BimCategory records
        send_progress('process-bimcategory', 'Processing BimCategory records...')
        bim_categories = {}
        for i, row in enumerate(df_categories.itertuples(), 1):
            group = models.BimGroup.objects.filter(types__display_name=row.display_name).first()
            if group:
                category, _ = models.BimCategory.objects.update_or_create(
                    bim_group=group,
                    value=row.value,
                    defaults={'display_name': row.display_name}
                )
                bim_categories[(row.value, row.display_name)] = category
            if i % 100 == 0:
                send_progress('process-bimcategory', f'Processed {i}/{len(df_categories)} BimCategory records.')
        send_progress('process-bimcategory', 'BimCategory processing completed.')

        # Extract BimObject data from SQLite
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
        df_objects = db.execute_query(object_query)
        send_progress('extract-bimobject', f'Extracted {len(df_objects)} BimObject records.')

        # Process BimObject records
        send_progress('process-bimobject', 'Processing BimObject records...')
        bim_objects = []
        for i, row in df_objects.iterrows():
            category = bim_categories.get((row['value'], row['display_name']))
            if category:
                bim_objects.append(
                    models.BimObject(
                        category=category,
                        dbid=row['dbid'],
                        primary_value=row['primary_value'],
                        display_name=row['display_name'],
                        value=row['value']
                    )
                )
            if i % 100 == 0:
                send_progress('process-bimobject', f'Processed {i}/{len(df_objects)} BimObject records.')
        models.BimObject.objects.bulk_create(bim_objects)
        send_progress('process-bimobject', f'BimObject processing completed: {len(bim_objects)} records inserted.')

        send_progress('complete', 'BIM data import completed.')


@shared_task
def bim_update_categories(sqlite_path, bim_model_id, file_name, group_name):
    def send_progress(status, message):
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            group_name, {
                'type': 'update.category',
                'name': file_name,
                'status': status,
                'message': message
            },
        )

    try:
        bim_model = models.BimModel.objects.get(id=bim_model_id)

        # Step 1: 從 BimGroup 獲取條件
        group_types = models.BimGroup.objects.filter(is_active=True).prefetch_related(
            'types').values('types__display_name', 'types__value')
        if not group_types:
            send_progress('error', "No active BimGroup types found.")
            raise Exception("No active BimGroup types found.")

        display_names = [gt['types__display_name'] for gt in group_types]
        value_conditions = {gt['types__display_name']: gt['types__value'] for gt in group_types if gt['types__value']}
        display_names_str = ','.join([f"'{d}'" for d in display_names])
        where_clause = f"attrs.display_name IN ({display_names_str})"
        if value_conditions:
            value_clauses = [
                f"(attrs.display_name = '{d}' AND CAST(vals.value AS TEXT) = '{v}')" for d, v in value_conditions.items()]
            where_clause = f"({where_clause}) AND ({' OR '.join(value_clauses)})"
        where_clause = where_clause if display_names else "1=0"

        # Step 2: 提取 BimCategory 資料
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

        # Step 4: 處理 BimCategory 和 BimObject
        with transaction.atomic():
            # 刪除舊資料
            deleted_count_categories = models.BimCategory.objects.filter(bim_model=bim_model).delete()
            send_progress('process-bimcategory', f'Deleted {deleted_count_categories} old BimCategory records.')

            # 處理 BimCategory
            send_progress('process-bimcategory', 'Processing BimCategory records...')
            bim_categories = {}
            for i, row in enumerate(df_categories.itertuples(), 1):
                group = models.BimGroup.objects.filter(types__display_name=row.display_name).first()
                if group:
                    category = models.BimCategory.objects.create(
                        bim_group=group,
                        bim_model=bim_model,  # 新增 bim_model 關聯
                        value=row.value,
                        display_name=row.display_name
                    )
                    bim_categories[(row.value, row.display_name)] = category
                if i % 100 == 0:
                    send_progress('process-bimcategory', f'Processed {i}/{len(df_categories)} BimCategory records.')
            send_progress('process-bimcategory', 'BimCategory processing completed.')

            # 處理 BimObject
            send_progress('process-bimobject', 'Processing BimObject records...')
            bim_objects = []
            for i, row in df_objects.iterrows():
                category = bim_categories.get((row['value'], row['display_name']))
                if category:
                    bim_objects.append(
                        models.BimObject(
                            category=category,
                            dbid=row['dbid'],
                            primary_value=row['primary_value'],
                            display_name=row['display_name'],
                            value=row['value']
                        )
                    )
                if i % 100 == 0:
                    send_progress('process-bimobject', f'Processed {i}/{len(df_objects)} BimObject records.')
            models.BimObject.objects.bulk_create(bim_objects)
            send_progress('process-bimobject', f'BimObject processing completed: {len(bim_objects)} records inserted.')

            # 更新 BimModel 的版本
            bim_model.version += 1
            bim_model.save()
            send_progress('complete', f'BIM data update completed for {bim_model.name} (v{bim_model.version}).')

        return {"categories_count": len(bim_categories), "objects_count": len(bim_objects)}

    except Exception as e:
        logger.error(f"Error updating Bim data: {str(e)}")
        send_progress('error', f"Error updating Bim data: {str(e)}")
        raise
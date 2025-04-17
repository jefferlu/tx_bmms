import time
import json
import sqlite3
import pandas as pd
import os

from django.db import transaction
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from celery import shared_task
from celery.utils.log import get_task_logger

from ..aps_toolkit import Auth, Bucket, Derivative, SVFReader, DbReader
from ..services import get_aps_urn
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

    start_time = time.time()

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

        # 傳遞 is_reload 給 process_translation
        result = process_translation(urn, token, file_name, object_data, send_progress, is_reload)

        elapsed_time = time.time() - start_time
        send_progress('complete', f'BIM data import completed in {elapsed_time:.2f} seconds.')
        return {"status": "BIM data import completed.", "file": file_name, "elapsed_time": elapsed_time, **result}
    except Exception as e:
        logger.error(str(e))
        send_progress('error', str(e))
        elapsed_time = time.time() - start_time
        return {"status": f"BIM data import failed: {str(e)}", "file": file_name, "elapsed_time": elapsed_time}


def process_translation(urn, token, file_name, object_data, send_progress, is_reload):
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
        # 檢查 file_name 格式
        parts = file_name.split('-')
        if len(parts) < 4:
            raise ValueError(f"Invalid file_name format: {file_name}. Expected at least 4 parts.")
        zone = parts[2].upper()
        level = parts[3].upper()

        # 確保 ZoneCode 和 LevelCode 存在
        try:
            zone_code = models.ZoneCode.objects.get(code=zone)
        except models.ZoneCode.DoesNotExist:
            raise ValueError(f"ZoneCode '{zone}' not found.")
        try:
            level_code = models.LevelCode.objects.get(code=level)
        except models.LevelCode.DoesNotExist:
            raise ValueError(f"LevelCode '{level}' not found.")

        if is_reload:
            # is_reload=True: 假設 BimModel 存在，不更新版本
            try:
                bim_model = models.BimModel.objects.get(name=file_name)
                send_progress('process-model-conversion', f'BimModel {bim_model.name} (v{bim_model.version}) reloaded.')
            except models.BimModel.DoesNotExist:
                raise ValueError(f"BimModel with name '{file_name}' not found during reload.")
        else:
            # is_reload=False: 創建新 BimModel 或更新版本
            bim_model, created = models.BimModel.objects.get_or_create(
                name=file_name,
                defaults={'urn': urn, 'version': 1, 'zone_code': zone_code, 'level_code': level_code}
            )
            if not created:
                # 若存在，更新 urn 並遞增版本
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

    start_time = time.time()

    try:
        result = _process_categories_and_objects(
            sqlite_path=sqlite_path,
            bim_model_id=bim_model_id,
            file_name=file_name,
            send_progress=send_progress
        )
        elapsed_time = time.time() - start_time
        send_progress('complete', f'BIM data update completed in {elapsed_time:.2f} seconds.')
        return {**result, "elapsed_time": elapsed_time}
    except Exception as e:
        logger.error(f"Error updating Bim data: {str(e)}")
        send_progress('error', f"Error updating Bim data: {str(e)}")
        elapsed_time = time.time() - start_time
        return {"error": f"Error updating Bim data: {str(e)}", "elapsed_time": elapsed_time}


def _process_categories_and_objects(sqlite_path, bim_model_id, file_name, send_progress):
    bim_model = models.BimModel.objects.get(id=bim_model_id)

    # Step 1: 獲取 BimGroup 條件
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

    # Step 2: 更新 BimCategory
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

    with transaction.atomic():
        existing_categories = {(c.bim_group_id, c.display_name, c.value): c for c in models.BimCategory.objects.all()}
        valid_pairs = set((group.id if group else None, row.display_name, row.value)
                          for row in df_categories.itertuples()
                          for group in [models.BimGroup.objects.filter(types__display_name=row.display_name).first()])

        to_delete = [cat.id for (grp_id, disp, val), cat in existing_categories.items() if (grp_id, disp, val) not in valid_pairs]
        deleted_count = models.BimCategory.objects.filter(id__in=to_delete).delete()[0]
        send_progress('cleanup-bimcategory', f'Deleted {deleted_count} outdated BimCategory records.')

        new_categories = {}
        for row in df_categories.itertuples():
            key = (row.display_name, row.value)
            group = models.BimGroup.objects.filter(types__display_name=row.display_name).first()
            if group and (group.id, row.display_name, row.value) not in existing_categories:
                category = models.BimCategory.objects.create(
                    bim_group=group,
                    value=row.value,
                    display_name=row.display_name
                )
                new_categories[key] = category

    # Step 3: 更新 BimObject
    send_progress('extract-bimobject', 'Extracting BimObject from SQLite...')
    object_query = """
        SELECT 
            eav.entity_id AS dbid,
            attrs.display_name AS display_name,
            CAST(vals.value AS TEXT) AS value
        FROM _objects_eav eav
        JOIN _objects_attr attrs ON attrs.id = eav.attribute_id
        JOIN _objects_val vals ON vals.id = eav.value_id
        WHERE vals.value IS NOT NULL AND attrs.display_name IS NOT NULL
            AND TRIM(vals.value) != ''
    """
    df_objects = pd.read_sql_query(object_query, conn)
    conn.close()
    send_progress('extract-bimobject', f'Extracted {len(df_objects)} BimObject records.')

    # 分批插入 BimObject
    existing_objects = models.BimObject.objects.filter(bim_model=bim_model)
    if not existing_objects.exists() or bim_model.version != bim_model.last_processed_version:
        if existing_objects.exists():
            existing_objects.delete()
            send_progress('process-bimobject', 'Cleared old BimObject records due to version change.')

        batch_size = 10000
        bim_objects = [
            models.BimObject(
                bim_model=bim_model,
                dbid=row.dbid,
                display_name=row.display_name,
                value=row.value
            ) for row in df_objects.itertuples()
        ]
        total = len(bim_objects)
        for i in range(0, total, batch_size):
            batch = bim_objects[i:i + batch_size]
            with transaction.atomic():
                models.BimObject.objects.bulk_create(batch)
            progress = min((i + len(batch)) / total * 100, 100)
            send_progress('process-bimobject', f'Inserted {i + len(batch)} of {total} records ({progress:.1f}%)')

        # 更新 last_processed_version
        bim_model.last_processed_version = bim_model.version
        bim_model.save()

    return {"categories_count": len(new_categories), "objects_count": len(df_objects)}

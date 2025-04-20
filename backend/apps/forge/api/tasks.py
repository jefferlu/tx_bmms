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

        # Pass is_reload to process_translation
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
        # Check file_name format
        parts = file_name.split('-')
        if len(parts) < 4:
            raise ValueError(f"Invalid file_name format: {file_name}. Expected at least 4 parts.")
        zone = parts[2].upper()
        level = parts[3].upper()

        # Ensure ZoneCode and LevelCode exist
        try:
            zone_code = models.ZoneCode.objects.get(code=zone)
        except models.ZoneCode.DoesNotExist:
            raise ValueError(f"ZoneCode '{zone}' not found.")
        try:
            level_code = models.LevelCode.objects.get(code=level)
        except models.LevelCode.DoesNotExist:
            raise ValueError(f"LevelCode '{level}' not found.")

        if is_reload:
            # is_reload=True: Assume BimModel exists, do not update version
            try:
                bim_model = models.BimModel.objects.get(name=file_name)
                send_progress('process-model-conversion', f'BimModel {bim_model.name} (v{bim_model.version}) reloaded.')
            except models.BimModel.DoesNotExist:
                raise ValueError(f"BimModel with name '{file_name}' not found during reload.")
        else:
            # is_reload=False: Create new BimModel or update version
            bim_model, created = models.BimModel.objects.get_or_create(
                name=file_name,
                defaults={'urn': urn, 'version': 1, 'zone_code': zone_code, 'level_code': level_code}
            )
            if not created:
                # If exists, update urn and increment version
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
        logger.error(f"Error updating BIM data: {str(e)}")
        send_progress('error', f"Error updating BIM data: {str(e)}")
        elapsed_time = time.time() - start_time
        return {"error": f"Error updating BIM data: {str(e)}", "elapsed_time": elapsed_time}


def _process_categories_and_objects(sqlite_path, bim_model_id, file_name, send_progress):
    bim_model = models.BimModel.objects.get(id=bim_model_id)

    # Step 1: Fetch BimCondition conditions
    conditions = models.BimCondition.objects.filter(is_active=True).values('id', 'display_name', 'value')
    if not conditions:
        send_progress('error', "No active BimCondition found.")
        raise Exception("No active BimCondition found.")

    # Step 2: Generate where_clause based on BimCondition
    condition_by_display = {}
    condition_by_value = {c['value']: c for c in conditions if c['value'] and not c['display_name']}
    for condition in conditions:
        if condition['display_name']:
            condition_by_display.setdefault(condition['display_name'], []).append(condition)
    clauses = []
    for condition in conditions:
        display_name = condition['display_name']
        value = condition['value']
        if display_name and value:
            clauses.append(f"(attrs.display_name = '{display_name}' AND CAST(vals.value AS TEXT) = '{value}')")
        elif display_name:
            clauses.append(f"attrs.display_name = '{display_name}'")
        elif value:
            clauses.append(f"CAST(vals.value AS TEXT) = '{value}'")
    where_clause = ' OR '.join(clauses) if clauses else 'FALSE'

    # Step 3: Update BimCategory
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
        # Delete all existing BimCategory for this bim_model
        deleted_count = models.BimCategory.objects.filter(bim_model_id=bim_model_id).delete()[0]
        send_progress('cleanup-bimcategory', f'Deleted {deleted_count} BimCategory records for bim_model_id={bim_model_id}.')

        # Create new BimCategory in bulk
        new_categories = []
        total_categories = len(df_categories)
        current_category = 0
        for row in df_categories.itertuples():
            current_category += 1
            condition = None
            # Try matching by display_name first
            if row.display_name in condition_by_display:
                for cond in condition_by_display[row.display_name]:
                    if not cond['value'] or cond['value'] == row.value:
                        condition = cond
                        break
            # If no display_name match, try matching by value
            if not condition and row.value in condition_by_value:
                condition = condition_by_value[row.value]

            if not condition:
                continue

            new_categories.append(
                models.BimCategory(
                    bim_model_id=bim_model_id,
                    condition_id=condition['id'],
                    value=row.value,
                    display_name=row.display_name
                )
            )
            send_progress('process-bimcategory', f'Processing BimCategory {current_category}/{total_categories}')

        # Bulk create new categories
        if new_categories:
            models.BimCategory.objects.bulk_create(new_categories)
            send_progress('process-bimcategory', f'Created {len(new_categories)} new BimCategory records.')

    # Step 4: Update BimObject (保持不變)
    existing_objects = models.BimObject.objects.filter(bim_model=bim_model)
    if not existing_objects.exists() or bim_model.version != bim_model.last_processed_version:
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
        send_progress('extract-bimobject', f'Extracted {len(df_objects)} BimObject records.')

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

        # Update last_processed_version
        bim_model.last_processed_version = bim_model.version
        bim_model.save()
    else:
        send_progress('process-bimobject', 'BimObject data is up-to-date, no update needed.')

    conn.close()
    return {"categories_count": len(new_categories), "objects_count": len(df_objects) if 'df_objects' in locals() else 0}

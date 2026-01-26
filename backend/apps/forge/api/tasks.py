import os
import time
import json
import re
import sqlite3
import pandas as pd
import shutil

from django.conf import settings
from collections import Counter

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
def bim_data_import(client_id, client_secret, bucket_key, file_name, group_name, user_id=None, is_reload=False):
    """
    Import BIM data from a file, including upload to Autodesk OSS, translation, and data processing.

    Args:
        client_id (str): Autodesk Forge client ID.
        client_secret (str): Autodesk Forge client secret.
        bucket_key (str): Autodesk OSS bucket key.
        file_name (str): Name of the file to process (e.g., 'T3-TP16-A06-1F-145-M3-AR-00001-7000').
        group_name (str): Channels group name for progress updates.
        user_id (int): ID of the user who uploaded the file.
        is_reload (bool): Whether to reload an existing object from the bucket.

    Returns:
        dict: Import status, file name, elapsed time, and processing results.
    """
    def send_progress(status, message):
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'progress.message',
                'name': file_name,
                'status': status,
                'message': message
            }
        )

    start_time = time.time()

    try:
        # Authenticate with Autodesk Forge
        auth = Auth(client_id, client_secret)
        token = auth.auth2leg()
        bucket = Bucket(token)

        # Upload or reload file
        if not is_reload:
            send_progress('upload-object', 'Uploading file to Autodesk OSS...')

            # 從 BimModel 取得版本號
            try:
                bim_model = models.BimModel.objects.get(name=file_name)
                version = bim_model.version + 1  # 新版本遞增
            except models.BimModel.DoesNotExist:
                version = 1  # 新檔案預設版本為 1

            # 構建上傳路徑：uploads/{file_name}/ver_{version}/{file_name}
            upload_dir = os.path.join(settings.MEDIA_ROOT, "uploads", file_name, f"ver_{version}").replace(os.sep, '/')
            upload_path = os.path.join(upload_dir, file_name).replace(os.sep, '/')
            os.makedirs(upload_dir, exist_ok=True)  # 確保目錄存在
            object_data = bucket.upload_object(bucket_key, upload_path, file_name)
            urn = get_aps_urn(object_data['objectId'])
        else:
            send_progress('reload-object', 'Reloading existing object from bucket...')
            objects = json.loads(bucket.get_objects(bucket_key, 100).to_json(orient='records'))
            object_data = next((item for item in objects if item['objectKey'] == file_name), None)
            if not object_data:
                raise Exception("Object not found in bucket.")
            urn = get_aps_urn(object_data['objectId'])

        # Process translation and data extraction
        result = process_translation(urn, token, file_name, object_data, send_progress, is_reload, user_id)

        elapsed_time = time.time() - start_time
        send_progress('complete', f'BIM data import completed in {elapsed_time:.2f} seconds.')
        return {"status": "BIM data import completed.", "file": file_name, "elapsed_time": elapsed_time, **result}
    except Exception as e:
        logger.error(str(e))
        send_progress('error', str(e))
        elapsed_time = time.time() - start_time
        return {"status": f"BIM data import failed: {str(e)}", "file": file_name, "elapsed_time": elapsed_time}


def process_translation(urn, token, file_name, object_data, send_progress, is_reload, user_id=None):
    """
    Process translation job, download SVF and SQLite, and update BimModel data.

    Args:
        urn (str): URN of the object.
        token (str): Autodesk Forge authentication token.
        file_name (str): Name of the file (e.g., 'T3-TP16-XXX-XX-XXX-M3-XX-00001.nwd').
        object_data (dict): Object data from Autodesk OSS.
        send_progress (callable): Function to send progress updates.
        is_reload (bool): Whether to reload an existing object.
        user_id (int): ID of the user who uploaded the file.

    Returns:
        dict: Processing results (categories, zones, hierarchies, objects).
    """
    # 從 BimModel 取得版本號
    try:
        bim_model = models.BimModel.objects.get(name=file_name)
        # 如果是重新載入，使用現有版本號；否則遞增版本號
        version = bim_model.version if is_reload else bim_model.version + 1
    except models.BimModel.DoesNotExist:
        if is_reload:
            raise ValueError(f"BimModel with name '{file_name}' not found during reload.")
        version = 1  # 新檔案預設版本為 1

    # Trigger translation job
    send_progress('translate-job', 'Triggering translation job...')
    derivative = Derivative(urn, token)
    translate_job_ret = json.loads(derivative.translate_job())
    if 'errorCode' in translate_job_ret:
        raise Exception(translate_job_ret['developerMessage'])

    # Monitor translation status
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

    # Download SVF
    send_progress('download-svf', 'Downloading SVF to server...')
    # 清理舊版本的 SVF 目錄（僅保留前一版）
    svf_base_dir = os.path.join(settings.MEDIA_ROOT, "svf", file_name).replace(os.sep, '/')
    if version > 2 and not is_reload:
        for v in range(1, version - 1):  # 僅保留 version - 1
            old_ver_dir = os.path.join(svf_base_dir, f"ver_{v}").replace(os.sep, '/')
            if os.path.exists(old_ver_dir):
                try:
                    shutil.rmtree(old_ver_dir)
                    send_progress('cleanup-svf', f'Removed old SVF directory: {old_ver_dir}')
                except Exception as e:
                    logger.warning(f"Failed to remove old SVF directory {old_ver_dir}: {str(e)}")

    # 構建新的 SVF 儲存路徑：svf/{file_name}/ver_{version}/
    svf_dir = os.path.join(settings.MEDIA_ROOT, "svf", file_name, f"ver_{version}").replace(os.sep, '/')
    os.makedirs(svf_dir, exist_ok=True)
    svf_reader = SVFReader(urn, token, "US")
    manifests = svf_reader.read_svf_manifest_items()
    if manifests:
        svf_reader.download(svf_dir, manifests[0], send_progress)
        send_progress('download-svf', 'SVF download completed.')
    else:
        raise Exception("No manifest items found for download.")

    # Find the .svf file in svf_dir or its subdirectories
    svf_name = None
    svf_files = []
    for root, _, files in os.walk(svf_dir):
        for file in files:
            if file.endswith('.svf'):
                absolute_svf_path = os.path.join(root, file).replace(os.sep, '/')
                svf_files.append(absolute_svf_path)
    if svf_files:
        # 選擇第一個 .svf 檔案並轉換為相對路徑
        selected_svf_path = svf_files[0]
        svf_name = os.path.relpath(selected_svf_path, settings.MEDIA_ROOT).replace(os.sep, '/')
        if len(svf_files) > 1:
            logger.warning(f"Multiple .svf files found in {svf_dir}: {svf_files}. Using {svf_name}.")
    else:
        send_progress('error', f"No .svf file found in {svf_dir}.")
        raise Exception(f"No .svf file found in {svf_dir}.")

    # Download SQLite
    send_progress('download-sqlite', 'Downloading SQLite to server...')
    db = DbReader(urn, token, object_data['objectKey'], send_progress)
    absolute_sqlite_path = db.db_path.replace(os.sep, '/')

    # 檢查 SQLite 檔案是否存在
    if not os.path.exists(absolute_sqlite_path):
        send_progress('error', f"SQLite file not found at {absolute_sqlite_path}")
        raise Exception(f"SQLite file not found at {absolute_sqlite_path}")

    # 清理舊版本的 SQLite 目錄（僅保留前一版）
    sqlite_base_dir = os.path.join(settings.MEDIA_ROOT, "sqlite", file_name).replace(os.sep, '/')
    if version > 2 and not is_reload:
        for v in range(1, version - 1):  # 僅保留 version - 1
            old_ver_dir = os.path.join(sqlite_base_dir, f"ver_{v}").replace(os.sep, '/')
            if os.path.exists(old_ver_dir):
                try:
                    shutil.rmtree(old_ver_dir)
                    send_progress('cleanup-sqlite', f'Removed old SQLite directory: {old_ver_dir}')
                except Exception as e:
                    logger.warning(f"Failed to remove old SQLite directory {old_ver_dir}: {str(e)}")

    # 構建新的 SQLite 儲存路徑：sqlite/{file_name}/ver_{version}/{file_name}.db
    sqlite_dir = os.path.join(settings.MEDIA_ROOT, "sqlite", file_name, f"ver_{version}").replace(os.sep, '/')
    os.makedirs(sqlite_dir, exist_ok=True)
    new_sqlite_path = os.path.join(sqlite_dir, f"{file_name}.db").replace(os.sep, '/')

    # 移動 SQLite 檔案到版本化目錄
    try:
        shutil.move(absolute_sqlite_path, new_sqlite_path)
        send_progress('download-sqlite', 'SQLite download and moved to versioned directory.')
    except Exception as e:
        send_progress('error', f"Failed to move SQLite file to {new_sqlite_path}: {str(e)}")
        raise Exception(f"Failed to move SQLite file: {str(e)}")

    # 更新 sqlite_path 為相對路徑
    sqlite_path = f"sqlite/{file_name}/ver_{version}/{file_name}.db".replace(os.sep, '/')
    send_progress('download-sqlite', 'SQLite processing completed.')

    # Create or update BimModel
    send_progress('process-model-conversion', 'Creating or updating BimModel...')
    with transaction.atomic():
        if not re.match(r'^([^-\n]+-){7}[^-\n]+$', file_name):
            raise ValueError(f"Invalid file_name format: {file_name}. (Expected XX-XXXX-XXX-XX-XXX-XX-XX-XXXXX)")

        if is_reload:
            try:
                bim_model = models.BimModel.objects.get(name=file_name)
                send_progress('process-model-conversion', f'BimModel {bim_model.name} (v{bim_model.version}) reloaded.')
            except models.BimModel.DoesNotExist:
                raise ValueError(f"BimModel with name '{file_name}' not found during reload.")
        else:
            # 获取 User 对象
            uploader = None
            if user_id:
                try:
                    from apps.account.models import User
                    uploader = User.objects.get(id=user_id)
                except User.DoesNotExist:
                    logger.warning(f"User with id={user_id} not found.")

            bim_model, created = models.BimModel.objects.get_or_create(
                name=file_name,
                defaults={'urn': urn, 'version': 1, 'uploader': uploader}
            )
            if not created:
                bim_model.urn = urn
                bim_model.version += 1
                # 更新 uploader (只在第一次上传时设置，之后版本更新不改变 uploader)
                if not bim_model.uploader and uploader:
                    bim_model.uploader = uploader
            # 更新 svf_path 和 sqlite_path 為相對路徑
            bim_model.svf_path = svf_name
            bim_model.sqlite_path = sqlite_path
            bim_model.save()
            send_progress('process-model-conversion', f'BimModel {bim_model.name} (v{bim_model.version}) updated.')

        # Process categories, regions, hierarchies, and objects
        try:
            result = _process_categories_and_objects(
                sqlite_path=new_sqlite_path,  # 使用移動後的絕對路徑
                bim_model_id=bim_model.id,
                file_name=file_name,
                send_progress=send_progress
            )
            send_progress('complete', f'BIM data import completed (v{bim_model.version}).')
        except Exception as e:
            send_progress('error', f"Failed to process categories and objects: {str(e)}")
            raise

    return result


@shared_task
def bim_update_categories(sqlite_path, bim_model_id, file_name, group_name, group_type):
    """
    Update BIM categories, regions, hierarchies, and objects from SQLite.

    Args:
        sqlite_path (str): Relative path to SQLite database (e.g., 'database/...db').
        bim_model_id (int): ID of the BimModel.
        file_name (str): Name of the file.
        group_name (str): Channels group name for progress updates.
        send_progress (callable, optional): Function to send progress updates.

    Returns:
        dict: Processing results or error details.
    """
    def send_progress(status, message):
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': group_type,
                'name': file_name,
                'status': status,
                'message': message
            }
        )

    start_time = time.time()

    try:
        # Convert relative sqlite_path to absolute path for file access
        absolute_sqlite_path = os.path.join(settings.MEDIA_ROOT, sqlite_path).replace(os.sep, '/')
        result = _process_categories_and_objects(
            sqlite_path=absolute_sqlite_path,
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
    """
    Process categories, regions, hierarchies, and objects from SQLite database.

    Args:
        sqlite_path (str): Absolute path to SQLite database.
        bim_model_id (int): ID of the BimModel.
        file_name (str): Name of the file.
        send_progress (callable): Function to send progress updates.

    Returns:
        dict: Counts of processed categories, regions, hierarchies, and objects.
    """
    try:
        bim_model = models.BimModel.objects.get(id=bim_model_id)
    except models.BimModel.DoesNotExist:
        raise ValueError(f"BimModel with id={bim_model_id} not found.")

    # Step 1: Fetch BimCondition conditions
    conditions = models.BimCondition.objects.all().values('id', 'display_name', 'value')
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
    try:
        df_categories = pd.read_sql_query(category_query, conn)
    except Exception as e:
        logger.error(f"Failed to extract BimCategory: {str(e)}")
        df_categories = pd.DataFrame(columns=['display_name', 'value'])
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
            if row.display_name in condition_by_display:
                for cond in condition_by_display[row.display_name]:
                    if not cond['value'] or cond['value'] == row.value:
                        condition = cond
                        break
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

        if new_categories:
            models.BimCategory.objects.bulk_create(new_categories)
            send_progress('process-bimcategory', f'Created {len(new_categories)} new BimCategory records.')

    # Step 3.5: Update BimRegion
    send_progress('extract-bimregion', 'Extracting BimRegion from SQLite...')
    parts = file_name.split('-')
    if not re.match(r'^([^-\n]+-){7}[^-\n]+$', file_name):
        raise ValueError(f"Invalid file_name format for BimRegion: {file_name}. Expected format: XX-XXXX-XXX-XX-XXX-XX-XX-XXXXX")
    prefix = f"{parts[0]}-{parts[1]}"

    region_query = """
        SELECT 
            eav.entity_id AS dbid,
            attrs.display_name AS display_name,
            CAST(vals.value AS TEXT) AS value
        FROM _objects_eav eav
        JOIN _objects_attr attrs ON attrs.id = eav.attribute_id
        JOIN _objects_val vals ON vals.id = eav.value_id
        WHERE attrs.display_name = 'Name' AND vals.value LIKE ?
    """
    conn = sqlite3.connect(sqlite_path)
    try:
        df_bim_regions = pd.read_sql_query(region_query, conn, params=(f"{prefix}%",))
    except Exception as e:
        logger.error(f"Failed to extract BimRegion: {str(e)}")
        raise Exception(f"Failed to extract BimRegion from SQLite: {str(e)}")
    send_progress('extract-bimregion', f'Extracted {len(df_bim_regions)} BimRegion records.')

    # 儲存 BimRegion 的 dbid 集合
    bim_region_dbids = set(df_bim_regions['dbid'].tolist())

    with transaction.atomic():
        deleted_count = models.BimRegion.objects.filter(bim_model=bim_model).delete()[0]
        send_progress('cleanup-bimregion', f'Deleted {deleted_count} BimRegion records for bim_model_id={bim_model_id}.')

        new_bim_regions = []
        missing_zones = set()
        missing_roles = set()
        total_bim_regions = len(df_bim_regions)
        current_bim_region = 0

        for row in df_bim_regions.itertuples():
            current_bim_region += 1
            value_parts = row.value.split('-')
            if len(value_parts) < 7:
                logger.warning(f"Skipping invalid value format in file '{file_name}': {row.value}")
                continue

            zone_code = value_parts[2]
            level = value_parts[3]
            role_code = value_parts[6]

            zone_obj = None
            if zone_code:
                try:
                    zone_obj = models.ZoneCode.objects.get(code=zone_code)
                except models.ZoneCode.DoesNotExist:
                    missing_zones.add(zone_code)
                    logger.warning(f"ZoneCode '{zone_code}' not found for value: {row.value} in file '{file_name}'")
                    # continue # 保留 zone_obj=None 寫入資料表，供稽核用

            role_obj = None
            if role_code:
                try:
                    role_obj = models.RoleCode.objects.get(code=role_code)
                except models.RoleCode.DoesNotExist:
                    missing_roles.add(role_code)
                    logger.warning(f"RoleCode '{role_code}' not found for value: {row.value} in file '{file_name}'")
                    # continue

            new_bim_regions.append(
                models.BimRegion(
                    bim_model=bim_model,
                    dbid=row.dbid,
                    value=row.value,
                    zone=zone_obj,
                    role=role_obj,
                    level=level
                )
            )
            send_progress('process-bimregion', f'Processing BimRegion {current_bim_region}/{total_bim_regions}')

        if missing_zones:
            send_progress('warning', f"Missing ZoneCode entries for file '{file_name}': {', '.join(missing_zones)}")
        if missing_roles:
            send_progress('warning', f"Missing RoleCode entries for file '{file_name}': {', '.join(missing_roles)}")

        if not new_bim_regions:
            send_progress(
                'error', f"No valid BimRegion records created for file '{file_name}'. Check ZoneCode and RoleCode values.")
            logger.error(f"No valid BimRegion records created for file '{file_name}'.")
        else:
            batch_size = 10000
            for i in range(0, len(new_bim_regions), batch_size):
                batch = new_bim_regions[i:i + batch_size]
                try:
                    models.BimRegion.objects.bulk_create(batch)
                    send_progress('process-bimregion', f'Created {i + len(batch)} of {len(new_bim_regions)} BimRegion records.')
                except Exception as e:
                    logger.error(f"Failed to create BimRegion batch: {str(e)}")
                    raise
            send_progress('process-bimregion', f'Created {len(new_bim_regions)} BimRegion records.')

    # Step 3.6: Update BimObjectHierarchy and prepare root_dbid mapping
    new_hierarchies = []
    hierarchy_dict = {}  # entity_id -> parent_id
    send_progress('extract-bimobjecthierarchy', 'Extracting BimObjectHierarchy from SQLite...')
    hierarchy_query = """
        SELECT 
            eav.entity_id AS entity_id,
            CAST(vals.value AS INTEGER) AS related_id
        FROM _objects_eav eav
        JOIN _objects_attr attrs ON attrs.id = eav.attribute_id
        JOIN _objects_val vals ON vals.id = eav.value_id
        WHERE attrs.category = '__parent__'            
    """
    try:
        df_hierarchy = pd.read_sql_query(hierarchy_query, conn)
        df_hierarchy = df_hierarchy.drop_duplicates(subset=['entity_id', 'related_id'])
    except Exception as e:
        logger.error(f"Failed to extract BimObjectHierarchy: {str(e)}")
        df_hierarchy = pd.DataFrame(columns=['entity_id', 'related_id'])
    send_progress('extract-bimobjecthierarchy', f'Extracted {len(df_hierarchy)} BimObjectHierarchy records.')

    # 構建 hierarchy_dict
    for row in df_hierarchy.itertuples():
        hierarchy_dict[row.entity_id] = row.related_id
        # new_hierarchies.append(
        #     models.BimObjectHierarchy(
        #         bim_model_id=bim_model_id,
        #         entity_id=row.entity_id,
        #         parent_id=row.related_id
        #     )
        # )

    # 計算每個 entity_id 的 root_dbid
    root_dbid_mapping = {}
    for entity_id in hierarchy_dict.keys():
        root_dbid = find_root_dbid(entity_id, hierarchy_dict, bim_region_dbids)
        root_dbid_mapping[entity_id] = root_dbid

    # Update BimObjectHierarchy
    # with transaction.atomic():
    #     deleted_count = models.BimObjectHierarchy.objects.filter(bim_model_id=bim_model_id).delete()[0]
    #     send_progress('cleanup-bimobjecthierarchy',
    #                   f'Deleted {deleted_count} BimObjectHierarchy records for bim_model_id={bim_model_id}.')

    #     if new_hierarchies:
    #         batch_size = 10000
    #         for i in range(0, len(new_hierarchies), batch_size):
    #             batch = new_hierarchies[i:i + batch_size]
    #             models.BimObjectHierarchy.objects.bulk_create(batch)
    #             send_progress('process-bimobjecthierarchy',
    #                           f'Created {i + len(batch)} of {len(new_hierarchies)} BimObjectHierarchy records.')

    # Step 4: Update BimObject with root_dbid

    # COBie定義白名單
    valid_display_names = set(
        models.BimCobie.objects.filter(is_active=True)
        .values_list('name', flat=True)
    )
    # 動態產生 IN (?, ?, ...) 佔位符
    placeholders = ','.join(['?'] * len(valid_display_names))

    existing_objects = models.BimObject.objects.filter(bim_model=bim_model)
    # if not existing_objects.exists() or bim_model.version != bim_model.last_processed_version:
    send_progress('extract-bimobject', 'Extracting BimObject from SQLite...')
    # object_query = """
    #     SELECT
    #         eav.entity_id AS dbid,
    #         attrs.display_name AS display_name,
    #         CAST(vals.value AS TEXT) AS value
    #     FROM _objects_eav eav
    #     JOIN _objects_attr attrs ON attrs.id = eav.attribute_id
    #     JOIN _objects_val vals ON vals.id = eav.value_id
    #     WHERE vals.value IS NOT NULL AND attrs.display_name IS NOT NULL
    #         AND TRIM(CAST(vals.value AS TEXT)) != ''
    # """
    object_query = f"""
        SELECT 
            eav.entity_id AS dbid,
            attrs.display_name AS display_name,
            NULLIF(TRIM(CAST(vals.value AS TEXT)), '') AS value
        FROM _objects_eav eav
        JOIN _objects_attr attrs ON attrs.id = eav.attribute_id
        JOIN _objects_val vals ON vals.id = eav.value_id
        WHERE 
            attrs.display_name IN ({placeholders})
            OR 
            (
                attrs.display_name NOT IN ({placeholders})
                AND NULLIF(TRIM(CAST(vals.value AS TEXT)), '') IS NOT NULL
            )
    """
    try:
        # df_objects = pd.read_sql_query(object_query, conn)
        df_objects = pd.read_sql_query(object_query, conn, params=list(valid_display_names) * 2)
    except Exception as e:
        logger.error(f"Failed to extract BimObject: {str(e)}")
        df_objects = pd.DataFrame(columns=['dbid', 'display_name', 'value'])
    send_progress('extract-bimobject', f'Extracted {len(df_objects)} BimObject records.')

    if existing_objects.exists():
        existing_objects.delete()
        send_progress('process-bimobject', 'Cleared old BimObject records due to version change.')

    df_objects['numeric_value'] = pd.to_numeric(df_objects['value'], errors='coerce')

    batch_size = 10000
    bim_objects = [
        models.BimObject(
            bim_model=bim_model,
            dbid=row.dbid,
            display_name=row.display_name,
            value=row.value,
            numeric_value=row.numeric_value if not pd.isna(row.numeric_value) else None,
            root_dbid=root_dbid_mapping.get(row.dbid),  # 設置 root_dbid
            parent_id=hierarchy_dict.get(row.dbid)  # 從 hierarchy_dict 設置 parent_id
        ) for row in df_objects.itertuples()
    ]
    total = len(bim_objects)
    for i in range(0, total, batch_size):
        batch = bim_objects[i:i + batch_size]
        with transaction.atomic():
            models.BimObject.objects.bulk_create(batch)
        progress = min((i + len(batch)) / total * 100, 100)
        send_progress('process-bimobject', f'Inserted {i + len(batch)} of {total} records ({progress:.1f}%)')

    bim_model.last_processed_version = bim_model.version
    bim_model.save()
    # else:
    #     send_progress('process-bimobject', 'BimObject data is up-to-date, no update needed.')

    conn.close()
    return {
        "categories_count": len(new_categories),
        "bim_regions_count": len(new_bim_regions) if new_bim_regions else 0,
        "hierarchy_count": len(new_hierarchies),
        "objects_count": len(df_objects) if 'df_objects' in locals() else 0
    }


def find_root_dbid(entity_id, hierarchy_dict, bim_region_dbids):
    """
    查找指定 entity_id 的根節點 dbid。

    Args:
        entity_id (int): 要查找的物件的 dbid。
        hierarchy_dict (dict): 儲存 entity_id 到 parent_id 的映射。
        bim_region_dbids (set): BimRegion 中的 dbid 集合。

    Returns:
        int or None: 根節點的 dbid，若無則返回 None。
    """
    current_id = entity_id
    visited = set()  # 避免迴圈
    while current_id in hierarchy_dict and current_id not in visited:
        if current_id in bim_region_dbids:
            return current_id
        visited.add(current_id)
        current_id = hierarchy_dict.get(current_id)
    return None  # 如果無法追溯到 BimRegion，則返回 None

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


# @shared_task
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

    # try:
    # Get aps token
    auth = Auth(client_id, client_secret)
    token = auth.auth2leg()
    bucket = Bucket(token)

    # Step 1: 上傳檔案到 Autodesk OSS
    if not is_reload:
        logger.info('Uploading file to Autodesk OSS...')
        print('Uploading file to Autodesk OSS...')
        send_progress('upload-object', 'Uploading file to Autodesk OSS...')

        object_data = bucket.upload_object(bucket_key, f'media-root/uploads/{file_name}', file_name)
        urn = get_aps_urn(object_data['objectId'])
    else:
        objects = json.loads(bucket.get_objects(bucket_key, 100).to_json(orient='records'))
        object_data = next((item for item in objects if item['objectKey'] == file_name), None)
        urn = get_aps_urn(object_data['objectId'])

    # file_name = urllib.parse.unquote(file_name)  # 反轉前端 encodeURIComponent()
    process_translation(urn, token, file_name, object_data, send_progress)

    # except Exception as e:
    #     logger.error(str(e))
    #     send_progress('error', str(e))


def process_translation(urn, token, file_name, object_data, send_progress):

    # """ Step 2: 開始轉檔 """
    # logger.info('Triggering translation job...')
    # print('Triggering translation job...')
    # send_progress('translate-job', 'Triggering translation job...')
    # derivative = Derivative(urn, token)
    # translate_job_ret = json.loads(derivative.translate_job())

    # if 'errorCode' in translate_job_ret:
    #     send_progress('error', translate_job_ret['developerMessage'])
    #     return

    # """ Step 3: 定期檢查轉檔狀態 """
    # logger.info('Monitoring translation status...')
    # print('Monitoring translation status...')
    # send_progress('translate-job', 'Monitoring translation status...')
    # while True:
    #     status = derivative.check_job_status()
    #     progress = status.get("progress", "unknown")

    #     logger.info(f'Translation progress: {progress}')
    #     print(f'Translation progress: {progress}')
    #     send_progress('translate-job', f'Translation progress: {progress}')

    #     if progress == "complete":
    #         logger.info('Translation complete.')
    #         print('Translation complete.')
    #         send_progress('translate-job', 'Translation complete.')
    #         break
    #     elif progress == "failed":
    #         logger.info('Translation failed.')
    #         print('Translation failed.')
    #         send_progress('translate-job', 'Translation failed.')
    #         return
    #     time.sleep(5)

    # """ Step 4: 下載 SVF """
    # logger.info('Downloading SVF to server ...')
    # print('Downloading SVF to server ...')
    # send_progress('download-svf', 'Downloading SVF to server ...')
    # svf_reader = SVFReader(urn, token, "US")
    # download_dir = f"media-root/svf/{file_name}"
    # if not os.path.exists(download_dir):
    #     os.makedirs(download_dir)

    # manifests = svf_reader.read_svf_manifest_items()
    # if manifests:
    #     manifest_item = manifests[0]
    #     svf_reader.download(download_dir, manifest_item, send_progress)
    #     logger.info('SVF download completed.')
    #     print('SVF download completed.')
    #     send_progress('download-svf', 'SVF download completed.')
    # else:
    #     logger.info('No manifest items found for download.')
    #     print('No manifest items found for download.')
    #     send_progress('download-svf', 'No manifest items found for download.')
    """ Step 5: 下載 SQLite """
    logger.info('Downloading SQLite to server ...')
    print('Downloading SQLite to server ...')
    send_progress('download-sqlite', 'Downloading SQLite to server ...')
    db = DbReader(urn, token, object_data['objectKey'])

    """ Step 6: 讀取 SQLite 並寫入相關資料表 """
    query = """
        SELECT distinct _objects_attr.category
        FROM _objects_id
        JOIN _objects_eav ON _objects_id.id = _objects_eav.entity_id
        JOIN _objects_attr ON _objects_eav.attribute_id = _objects_attr.id
        JOIN _objects_val ON _objects_eav.value_id = _objects_val.id
        WHERE _objects_attr.display_name LIKE '%Cobie%';
    """
    df = db.execute_query(query)
    categories = df['category'].tolist()

    # 寫入Category
    existing_categories = models.BimCategory.objects.filter(name__in=categories).values_list('name', flat=True)
    existing_categories_set = set(existing_categories)  # 複雜度O(1)

    # 批量插入
    new_categories = [category for category in categories if category not in existing_categories_set]
    new_bim_categories = [models.BimCategory(name=category) for category in new_categories]
    with transaction.atomic():
        models.BimCategory.objects.bulk_create(new_bim_categories)

    # 寫入 BimModel
    bim_model, created = models.BimModel.objects.get_or_create(
        name=file_name,
        defaults={}
    )

    # 取得最新版本號
    bim_conversion_version = get_conversion_version(bim_model)

    # 寫入 BimConversion
    bim_conversion = models.BimConversion.objects.create(
        bim_model=bim_model,
        urn=urn,
        version=bim_conversion_version,  # 這裡的版本號需要依照邏輯設定
        original_file=f"media-root/upload{file_name}",  # 假設這裡是上傳的文件路徑
        svf_file=f"media-root/svf/{file_name}",  # 假設這是下載後的 SVF 文件路徑
    )

    # 寫入 BimProperty    
    query = """
        SELECT ids.id AS dbid, attrs.category AS category, COALESCE(NULLIF(attrs.display_name, ''),attrs.name) AS name, vals.value AS value
        FROM _objects_eav eav
        LEFT JOIN _objects_id ids ON ids.id = eav.entity_id
        LEFT JOIN _objects_attr attrs ON attrs.id = eav.attribute_id
        LEFT JOIN _objects_val vals on vals.id = eav.value_id   
        WHERE attrs.display_name like 'COBie%'
        ORDER BY dbid
    """
    property_df  = db.execute_query(query)
    categories = df['category'].tolist()

    bim_category_mapping = {category.name: category for category in models.BimCategory.objects.all()}
    bim_properties = []

    for row in property_df.itertuples():
        category_name = row.category
        bim_category = bim_category_mapping.get(category_name)

        # 若該類別不存在，則跳過（或者你也可以選擇創建新類別並插入）
        if not bim_category:
            continue  # 或者可以選擇創建新的類別並將其加到映射

        # 建立 BIMProperty 物件
        bim_property = models.BIMProperty(
            category=bim_category,  # 使用查詢到的 BimCategory 實例
            conversion=bim_conversion,  # 假設每個 BIMProperty 都與 BimConversion 關聯
            name=row.name,
            value=row.value,
            dbid=row.dbid
        )
        bim_properties.append(bim_property)

    # 批量插入 BIMProperty
    with transaction.atomic():
        models.BIMProperty.objects.bulk_create(bim_properties)

    # 通知完成
    logger.info('BIM data imoport complete.')
    print('BIM data imoport complete.')
    send_progress('complete', 'BIM data imoport completed.')

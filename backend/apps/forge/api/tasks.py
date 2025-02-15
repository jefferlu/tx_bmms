import os
import time
import json
import pandas as pd

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from celery import shared_task
from celery.utils.log import get_task_logger

from ..aps_toolkit import Auth, Bucket, Derivative, SVFReader, DbReader
from ..services import get_aps_urn, get_conversion_version, process_sqlite_data
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

        process_translation(urn, token, file_name, object_data, send_progress)

    except Exception as e:
        logger.error(str(e))
        send_progress('error', str(e))


def process_translation(urn, token, file_name, object_data, send_progress):

    # Step 2: 開始轉檔
    logger.info('Triggering translation job...')
    print('Triggering translation job...')
    send_progress('translate-job', 'Triggering translation job...')
    derivative = Derivative(urn, token)
    translate_job_ret = json.loads(derivative.translate_job())

    if 'errorCode' in translate_job_ret:
        send_progress('error', translate_job_ret['developerMessage'])
        return

    # Step 3: 定期檢查轉檔狀態
    logger.info('Monitoring translation status...')
    print('Monitoring translation status...')
    send_progress('translate-job', 'Monitoring translation status...')
    while True:
        status = derivative.check_job_status()
        progress = status.get("progress", "unknown")

        logger.info(f'Translation progress: {progress}')
        print(f'Translation progress: {progress}')
        send_progress('translate-job', f'Translation progress: {progress}')

        if progress == "complete":
            logger.info('Translation complete.')
            print('Translation complete.')
            send_progress('translate-job', 'Translation complete.')
            break
        elif progress == "failed":
            logger.info('Translation failed.')
            print('Translation failed.')
            send_progress('translate-job', 'Translation failed.')
            return
        time.sleep(5)

    # Step 4: 下載 SVF
    logger.info('Downloading SVF to server ...')
    print('Downloading SVF to server ...')
    send_progress('download-svf', 'Downloading SVF to server ...')
    svf_reader = SVFReader(urn, token, "US")
    download_dir = f"media-root/svf/{file_name}"
    if not os.path.exists(download_dir):
        os.makedirs(download_dir)

    manifests = svf_reader.read_svf_manifest_items()
    if manifests:
        manifest_item = manifests[0]
        svf_reader.download(download_dir, manifest_item, send_progress)
        logger.info('SVF download completed.')
        print('SVF download completed.')
        send_progress('download-svf', 'SVF download completed.')
    else:
        logger.info('No manifest items found for download.')
        print('No manifest items found for download.')
        send_progress('download-svf', 'No manifest items found for download.')

    # Step 5: 下載 SQLite
    logger.info('Downloading SQLite to server ...')
    print('Downloading SQLite to server ...')
    send_progress('download-sqlite', 'Downloading SQLite to server ...')
    db = DbReader(urn, token, object_data['objectKey'])

    # Step 6: 讀取 SQLite 並寫入資料庫

    sqlite_path = f"media-root/database/{file_name}.sqlite"

    parts = file_name.split('-')
    if len(parts) >= 2:
        parent_name = f"{parts[0]}-{parts[1]}"
    else:
        parent_name = 'Uncategorized'

    # 創建父層 Tender
    parent_tender, created = models.BimTender.objects.get_or_create(name=parent_name)

    bim_model, created = models.BimModel.objects.get_or_create(
        tender=parent_tender,
        name=file_name,
        defaults={}
    )

    bim_conversion_version = get_conversion_version(bim_model)

    bim_conversion = models.BimConversion.objects.create(
        bim_model=bim_model,
        urn=urn,
        version=bim_conversion_version,  # 這裡的版本號需要依照邏輯設定
        original_file=f"media-root/upload{file_name}",  # 假設這裡是上傳的文件路徑
        svf_file=f"media-root/svf/{file_name}",  # 假設這是下載後的 SVF 文件路徑
    )

    # process_sqlite_data(sqlite_path, bim_model.id)

    # 通知完成
    logger.info('BIM data imoport complete.')
    print('BIM data imoport complete.')
    send_progress('complete', 'BIM data imoport completed.')

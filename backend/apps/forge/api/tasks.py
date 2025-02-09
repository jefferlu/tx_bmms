import os
import time
import json
import pandas as pd

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from celery import shared_task
from celery.utils.log import get_task_logger

from ..aps_toolkit import Auth, Bucket, Derivative, SVFReader, DbReader

logger = get_task_logger(__name__)


@shared_task
def bim_data_import(client_id, client_secret, bucket_key, file_name, group_name):

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
    logger.info('Uploading file to Autodesk OSS...')
    print('Uploading file to Autodesk OSS...')
    send_progress('upload-object', 'Uploading file to Autodesk OSS...')
    object_data = bucket.upload_object(bucket_key, f'media-root/uploads/{file_name}', file_name)
    urn = bucket.get_urn(object_data['objectId'])

    process_translation(urn, token, object_data, send_progress)
        
    # except Exception as e:
    #     logger.error(str(e))
    #     send_progress('error', str(e))


def process_translation(urn, token, object_data, send_progress):
    # Step 2: 開始轉檔
    logger.info('Triggering translation job...')
    send_progress('translate-job', 'Triggering translation job...')
    derivative = Derivative(urn, token)
    translate_job_ret = json.loads(derivative.translate_job())

    if 'errorCode' in translate_job_ret:
        send_progress('error', translate_job_ret['developerMessage'])
        return

    # Step 3: 定期檢查轉檔狀態
    logger.info('Monitoring translation status...')
    send_progress('translate-job', 'Monitoring translation status...')
    while True:
        status = derivative.check_job_status()
        progress = status.get("progress", "unknown")

        logger.info(f'Translation progress: {progress}')
        send_progress('translate-job', f'Translation progress: {progress}')

        if progress == "complete":
            logger.info('Translation complete.')
            send_progress('translate-job', 'Translation complete.')
            break
        elif progress == "failed":
            logger.info('Translation failed.')
            send_progress('translate-job', 'Translation failed.')
            return
        time.sleep(5)

    # Step 4: 下載 SVF
    logger.info('Downloading SVF to server ...')
    send_progress('download-svf', 'Downloading SVF to server ...')
    svf_reader = SVFReader(urn, token, "US")
    download_dir = "media-root/downloads"
    if not os.path.exists(download_dir):
        os.makedirs(download_dir)

    manifests = svf_reader.read_svf_manifest_items()
    if manifests:
        manifest_item = manifests[0]
        svf_reader.download(download_dir, manifest_item, send_progress)
        logger.info('SVF download completed.')
        send_progress('download-svf', 'SVF download completed.')
    else:
        logger.info('No manifest items found for download.')
        send_progress('download-svf', 'No manifest items found for download.')

    # Step 5: 下載 SQLite
    logger.info('Downloading SQLite to server ...')
    send_progress('download-sqlite', 'Downloading SQLite to server ...')
    db = DbReader(urn, token, object_data['objectKey'])

    # 通知完成
    logger.info('BIM data imoport complete.')
    send_progress('complete', 'BIM data imoport completed.')

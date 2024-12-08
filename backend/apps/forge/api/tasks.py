import os
import time
import pandas as pd

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from celery import shared_task

from ..aps_toolkit import Auth, Bucket, Derivative, SVFReader, DbReader


@shared_task()
def bim_data_import1(client_id, client_secret, bucket_key, file_name, group_name):
    channel_layer = get_channel_layer()

    def send_progress(message):
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                "type": "progress.message",
                "message": message
            },
        )
    try:
        # 取得 API token
        auth = Auth(client_id, client_secret)
        token = auth.auth2leg()
        bucket = Bucket(token)

        # Step 1: 上傳檔案到 Autodesk OSS
        send_progress(f"Starting upload for file {file_name}...")

        print('Uploading file to Autodesk OSS...')

        # 假設每個上傳的步驟進度為 10%
        object_data = bucket.upload_object(bucket_key, f'media-root/uploads/{file_name}', file_name)
        send_progress({"progress": 10, "status": "上傳檔案中..."})

        urn = bucket.get_urn(object_data['objectId'])
        send_progress({"progress": 50, "status": "檔案上傳完成，處理中..."})

        # 這裡可以新增其他處理步驟，並更新進度
        # 假設有些轉換或處理過程，進度逐步更新
        # send_progress({"progress": 80, "status": "轉換處理中..."})

        # # Step 2: 完成
        # send_progress('finish', f"檔案 {file_name} 上傳並處理完成")
        # print('Upload to OSS completed.')

    except Exception as e:
        send_progress(str(e))
        print(f"Error: {e}")


@shared_task
def bin_data_import(client_id, client_secret, bucket_key, file_name, group_name):
    def send_progress(message):
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            group_name, {
                "type": "progress.message",
                "message": message
            },
        )

    try:
        # Get aps token
        auth = Auth(client_id, client_secret)
        token = auth.auth2leg()
        bucket = Bucket(token)

        # Step 1: 上傳檔案到 Autodesk OSS
        print('Uploading file to Autodesk OSS...')
        send_progress('Uploading file to Autodesk OSS...')
        object_data = bucket.upload_object(bucket_key, f'media-root/uploads/{file_name}', file_name)
        urn = bucket.get_urn(object_data['objectId'])

        # Step 2: 觸發轉檔
        print('Triggering translation job...')
        send_progress('Triggering translation job...')
        derivative = Derivative(urn, token)
        translate_job_ret = derivative.translate_job()

        # Step 3: 定期檢查轉檔狀態
        print('Monitoring translation status...')
        send_progress('Monitoring translation status...')
        while True:
            status = derivative.check_job_status()
            progress = status.get("progress", "unknown")
            print(f'Translation progress: {progress}')
            send_progress(f'Translation progress: {progress}')

            if progress == "complete":
                print('Translation complete. Ready to download.')
                print('Translation complete. Ready to download.')
                break
            elif progress == "failed":
                print('Translation failed.')
                print('Translation failed.')
                return
            time.sleep(5)

        # Step 4: 下載 SVF
        print('Downloading SVF to server ...')
        send_progress('Downloading SVF to server ...')
        svf_reader = SVFReader(urn, token, "US")
        download_dir = "media-root/downloads"
        if not os.path.exists(download_dir):
            os.makedirs(download_dir)

        manifests = svf_reader.read_svf_manifest_items()
        if manifests:
            manifest_item = manifests[0]
            svf_reader.download(download_dir, manifest_item, send_progress)
            print('SVF download completed.')
            send_progress('SVF download completed.')
        else:
            print('No manifest items found for download.')
            send_progress('No manifest items found for download.')

        # 通知完成
        print('BIM data imoport completed.')
        send_progress('BIM data imoport completed.')

    except Exception as e:
        print(str(e))
        send_progress(str(e))

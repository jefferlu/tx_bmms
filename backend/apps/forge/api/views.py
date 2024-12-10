import json
import base64
import redis
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, FileUploadParser
from rest_framework.response import Response

from drf_spectacular.utils import extend_schema

from utils.utils import Utils
from ..aps_toolkit import Auth, Bucket
from . import serializers
from apps.forge.api.tasks import bim_data_import

CLIENT_ID = '94MGPGEtqunCJS6XyZAAnztSSIrtfOLsVWQEkLNQ7uracrAC'
CLIENT_SECRET = 'G5tBYHoxe9xbpsisxGo5kBZOCPwEFCCuXIYr8kms28SSRuuVAHR0G766A3RKFQXy'
BUCKET_KEY = 'bmms_oss'


@extend_schema(
    summary="List buckets",
    description="Using the OSS service to list Buckets.",
    tags=['APS']
)
class BucketView(APIView):
    
    def get(self, request):
        auth = Auth(CLIENT_ID, CLIENT_SECRET)
        token = auth.auth2leg()
        bucket = Bucket(token)
        buckets = json.loads(bucket.get_all_buckets().to_json(orient='records'))

        return Response(buckets, status=status.HTTP_200_OK)


@extend_schema(
    summary="List objects",
    description="Using the OSS service to list Objects.",
    tags=['APS']
)
class ObjectView(APIView):

    def get(self, request):
        auth = Auth(CLIENT_ID, CLIENT_SECRET)
        token = auth.auth2leg()
        bucket = Bucket(token)
        objects = json.loads(bucket.get_objects(BUCKET_KEY).to_json(orient='records'))

        serializer = serializers.ObjectSerializer(objects, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


@extend_schema(
    summary="BIM Data Import",
    description="Endpoint to import BIM data",
    tags=['APS']
)
class BimDataImportView(APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        file = request.FILES.get('file')
        if not file:
            return Response({"error": "No file provided"}, status=400)

        Utils.checkRedis('localhost')
        
        # Save file
        print('Saving file...')
        file_path = f'uploads/{file.name}'
        if default_storage.exists(file_path):
            default_storage.delete(file_path)
        default_storage.save(file_path, ContentFile(file.read()))

        # 執行Autodesk Model Derivative API轉換
        bim_data_import.delay(CLIENT_ID, CLIENT_SECRET, BUCKET_KEY, file.name, 'progress_group')
        # bin_data_import(CLIENT_ID, CLIENT_SECRET, BUCKET_KEY, file.name,'progress_group')

        # # 回應上傳成功的訊息
        return Response({"message": f"File '{file.name}' is being processed."}, status=200)

    # def handle_translation(self, file):
    #     def send_sse_event(event_type='message', event_data=None):
    #         """
    #         發送 SSE 消息
    #         """
    #         send_event(f'file-{file.name}', event_type, event_data)

    #     auth = Auth(CLIENT_ID, CLIENT_SECRET)
    #     token = auth.auth2leg()
    #     bucket = Bucket(token)

    #     # Step 1: 上傳檔案到 Autodesk OSS
    #     print('Uploading file to Autodesk OSS...')
    #     send_sse_event('upload_object', {'status': 'start'})
    #     object_data = bucket.upload_object_stream(BUCKET, file, file.name)
    #     encoded_data = base64.urlsafe_b64encode(object_data['objectId'].encode("utf-8")).rstrip(b'=')
    #     urn = encoded_data.decode("utf-8")

    #     send_sse_event('upload_object', {'status': 'completed'})
    #     print('Upload to OSS completed.')

    #     # Step 2: 觸發轉檔
    #     print('Triggering translation job...')
    #     send_sse_event('translate_job', {'status': 'start'})
    #     derivative = Derivative(urn, token)
    #     translate_job_ret = derivative.translate_job()
    #     print('Translation job triggered.')
    #     send_sse_event('translate_job', {'status': 'triggered'})

    #     # Step 3: 定期檢查轉檔狀態
    #     print('Monitoring translation status...')
    #     send_sse_event('monitor_translation', {'status': 'start'})
    #     while True:
    #         status = derivative.check_job_status()
    #         print('-->', status)
    #         progress = status.get("progress", "unknown")
    #         print(f'Translation progress: {progress}')
    #         send_sse_event('monitor_translation', {'status': progress})

    #         if progress == "complete":
    #             print('Translation complete. Ready to download.')
    #             send_sse_event('monitor_translation', {'status': 'complete'})
    #             break
    #         elif progress == "failed":
    #             print('Translation failed.')
    #             send_sse_event('monitor_translation', {'status': 'failed'})
    #             return
    #         time.sleep(5)

    #     # Step 4: 下載 SVF
    #     print('Downloading SVF...')
    #     send_sse_event('download_svf', {'status': 'start'})
    #     svf_reader = SVFReader(urn, token, "US")
    #     download_dir = "media-root/downloads"
    #     if not os.path.exists(download_dir):
    #         os.makedirs(download_dir)

    #     manifests = svf_reader.read_svf_manifest_items()
    #     if manifests:
    #         manifest_item = manifests[0]
    #         svf_reader.download(download_dir, manifest_item, send_sse_event)
    #         print('SVF download completed.')
    #         send_sse_event('download_svf', {'status': 'completed'})
    #     else:
    #         print('No manifest items found for download.')
    #         send_sse_event('download_svf', {'status': 'failed'})

    #     # 通知完成
    #     send_sse_event('processing', {'status': 'completed'})


# class BimDataImportView(APIView):
#     parser_classes = (MultiPartParser, FormParser)

#     def post(self, request, *args, **kwargs):
#         file = request.FILES.get('file')
#         if not file:
#             return Response({"error": "No file provided"}, status=400)

#         # Save file
#         print('Saving file...')
#         file_path = f'uploads/{file.name}'
#         if default_storage.exists(file_path):
#             default_storage.delete(file_path)
#         default_storage.save(file_path, ContentFile(file.read()))

#         # Start processing in the background
#         self.handle_processing(file.name)

#         return Response({"file_url": file_path}, status=200)

#     def handle_processing(self, file_name):
#         def send_sse_event(event_type='message', event_data=None):
#             """
#             發送 SSE 消息
#             """
#             send_event(f'file-{file_name}', event_type, event_data)

#         # 模擬檔案處理流程
#         auth = Auth(CLIENT_ID, CLIENT_SECRET)
#         token = auth.auth2leg()
#         bucket = Bucket(token)

#         # Step 1: 上傳檔案
#         print('Uploading object to OSS...')
#         send_sse_event('upload_object', {'status': 'start'})
#         object_data = bucket.upload_object(BUCKET, f'media-root/uploads/{file_name}', file_name)
#         encoded_data = base64.urlsafe_b64encode(object_data['objectId'].encode("utf-8")).rstrip(b'=')
#         urn = encoded_data.decode("utf-8")
#         print('Upload completed.')
#         send_sse_event('upload_object', {'status': 'completed'})

#         # Step 2: 觸發轉檔
#         print('Triggering translation job...')
#         send_sse_event('translate_job', {'status': 'start'})
#         derivative = Derivative(urn, token)
#         translate_job_ret = derivative.translate_job()
#         print('Translation job triggered.')
#         send_sse_event('translate_job', {'status': 'triggered'})

#         # Step 3: 定期檢查轉檔狀態
#         print('Monitoring translation status...')
#         send_sse_event('monitor_translation', {'status': 'start'})
#         while True:
#             status = derivative.check_job_status()
#             print('-->',status)
#             progress = status.get("progress", "unknown")
#             print(f'Translation progress: {progress}')
#             send_sse_event('monitor_translation', {'status': progress})

#             if progress == "complete":
#                 print('Translation complete. Ready to download.')
#                 send_sse_event('monitor_translation', {'status': 'complete'})
#                 break
#             elif progress == "failed":
#                 print('Translation failed.')
#                 send_sse_event('monitor_translation', {'status': 'failed'})
#                 return
#             time.sleep(5)

#         # Step 4: 下載 SVF
#         print('Downloading SVF...')
#         send_sse_event('download_svf', {'status': 'start'})
#         svf_reader = SVFReader(urn, token, "US")
#         download_dir = "media-root/downloads"
#         if not os.path.exists(download_dir):
#             os.makedirs(download_dir)

#         manifests = svf_reader.read_svf_manifest_items()
#         if manifests:
#             manifest_item = manifests[0]
#             svf_reader.download(download_dir, manifest_item, send_sse_event)
#             print('SVF download completed.')
#             send_sse_event('download_svf', {'status': 'completed'})
#         else:
#             print('No manifest items found for download.')
#             send_sse_event('download_svf', {'status': 'failed'})

#         # 通知完成
#         send_sse_event('processing', {'status': 'completed'})

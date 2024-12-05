import os
import json
import pandas as pd
from django.core.files.storage import FileSystemStorage, default_storage
from django.core.files.base import ContentFile

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, FileUploadParser
from rest_framework.response import Response

from drf_spectacular.utils import extend_schema
from django_eventstream import send_event

from ..aps_toolkit import Auth, Bucket, Derivative, SVFReader
from . import serializers

CLIENT_ID = '94MGPGEtqunCJS6XyZAAnztSSIrtfOLsVWQEkLNQ7uracrAC'
CLIENT_SECRET = 'G5tBYHoxe9xbpsisxGo5kBZOCPwEFCCuXIYr8kms28SSRuuVAHR0G766A3RKFQXy'
BUCKET = 'bmms_oss'

auth = Auth(CLIENT_ID, CLIENT_SECRET)
token = auth.auth2leg()


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
        objects = json.loads(bucket.get_objects(BUCKET).to_json(orient='records'))

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

        print('file saved')
        # Save file
        file_path = f'uploads/{file.name}'
        if default_storage.exists(file_path):
            default_storage.delete(file_path)
        default_storage.save(file_path, ContentFile(file.read()))

        self.handle_file_processing(file.name, file_path)

        return Response({"file_url": file_path}, status=200)

    def handle_file_processing(self, file_name, file_path):
        auth = Auth(CLIENT_ID, CLIENT_SECRET)
        token = auth.auth2leg()
        bucket = Bucket(token)

        # Upload file to OSS
        print('start upload_object...')
        object = bucket.upload_object(BUCKET, f'media-root/uploads/{file_name}', file_name)
        print('upload_object done.')

        # Translate job
        print('start translate_job...')
        urn = 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6Ym1tc19vc3MvYm94LmlwdA'
        derivative = Derivative(urn, token)
        translate_job = derivative.translate_job('')
        print('translate_job done.')

        # Download SVF
        print('start svfDownload...')
        svfReader = SVFReader(urn, token, "US")
        manifests = svfReader.read_svf_manifest_items()
        manifests_item = manifests[0]
        dir = "downloads"
        if not os.path.exists(dir):
            os.makedirs(dir)
        svfReader.download(dir, manifests_item)
        print('svfDownload done.')

        # total_steps = 10  # 假設處理步驟為 10 步
        # for step in range(total_steps):
        #     time.sleep(1)  # 假設每步處理需要 1 秒鐘

        #     # 每處理完一個步驟就透過 SSE 推送進度
        #     send_sse_event('file_processing', file_name, {
        #         'step': step + 1,
        #         'total_steps': total_steps,
        #         'status': 'processing'
        #     })

        # # 假設處理完畢後推送完成訊息
        # send_sse_event('file_processing', file_name, {
        #     'step': total_steps,
        #     'total_steps': total_steps,
        #     'status': 'completed'
        # })


def send_sse_event(action, file_name, progress_data):

    # send_event(<channel>, <event_type>, <event_data>)
    send_event('file',
               'message',
               {
                   'action': action,
                   'file_name': file_name,
                   **progress_data,  # 包括處理進度數據
               })

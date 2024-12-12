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
from ..aps_toolkit import Auth, Bucket, Derivative
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

        # Check ojbect job status
        # for obj in objects:
        #     urn = bucket.get_urn(obj['objectId'])
        #     derivative = Derivative(urn, token)
        #     ret = derivative.check_job_status()
        #     obj['status'] = ret.get('progress', 'ready')
        #     print(obj)

        serializer = serializers.ObjectSerializer(objects, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


@ extend_schema(
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

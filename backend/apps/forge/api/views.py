import os
import json
import sqlite3
import pandas as pd
from pathlib import Path
from collections import defaultdict

from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.db.models import Subquery, OuterRef, Prefetch, Q

from django.db import connection

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from rest_framework import status, viewsets, pagination
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, FileUploadParser
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from rest_framework.exceptions import ValidationError

from django_auto_prefetching import AutoPrefetchViewSetMixin

from drf_spectacular.utils import extend_schema

from apps.forge.api.tasks import bim_data_import, bim_update_categories
from apps.forge.services import check_redis, get_aps_credentials, get_aps_bucket

from ..aps_toolkit import Auth, Bucket, Derivative, PropReader

from apps.core.services import log_user_activity

from . import serializers
from .. import models

# CLIENT_ID = '94MGPGEtqunCJS6XyZAAnztSSIrtfOLsVWQEkLNQ7uracrAC'
# CLIENT_SECRET = 'G5tBYHoxe9xbpsisxGo5kBZOCPwEFCCuXIYr8kms28SSRuuVAHR0G766A3RKFQXy'
# BUCKET_KEY = 'bmms_oss'


class AuthView(APIView):
    def get(self, request):
        try:
            client_id, client_secret = get_aps_credentials(request.user)

            auth = Auth(client_id, client_secret)
            token = auth.auth2leg()
            return Response({'access_token': token.access_token}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({'error': f'{str(e)}'})


@extend_schema(
    summary="List buckets",
    description="Using the OSS service to list Buckets.",
    tags=['APS']
)
class BucketView(APIView):

    def get(self, request):
        try:
            client_id, client_secret = get_aps_credentials(request.user)

            auth = Auth(client_id, client_secret)
            token = auth.auth2leg()
            bucket = Bucket(token)
            data = json.loads(bucket.get_all_buckets().to_json(orient='records'))

            return Response(data, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({'error': f'{str(e)}'})


@extend_schema(
    summary="List objects",
    description="Using the OSS service to list Objects.",
    tags=['APS']
)
class ObjectView(APIView):

    def get(self, request):
        try:
            client_id, client_secret = get_aps_credentials(request.user)
            bucket_key = get_aps_bucket(client_id, client_secret)

            auth = Auth(client_id, client_secret)
            token = auth.auth2leg()
            bucket = Bucket(token)
            objects = json.loads(bucket.get_objects(bucket_key, 100).to_json(orient='records'))

            # Check ojbect job status
            # for obj in objects:
            #     urn = bucket.get_urn(obj['objectId'])
            #     derivative = Derivative(urn, token)
            #     ret = derivative.check_job_status()
            #     obj['status'] = ret.get('progress', 'ready')

            serializer = serializers.ObjectSerializer(objects, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({'error': f'{str(e)}'})

    def delete(self, request, name=None):
        try:
            client_id, client_secret = get_aps_credentials(request.user)
            bucket_key = get_aps_bucket(client_id, client_secret)

            auth = Auth(client_id, client_secret)
            token = auth.auth2leg()
            bucket = Bucket(token)
            obj = bucket.delete_object(bucket_key, name)

            return Response(obj, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': f'{str(e)}'})


class CompareSqliteView(APIView):
    def compare_models_without_metadata(self, model_1_db, model_2_db):
        """比較兩個模型，忽略時間戳和其他元數據欄位"""
        try:
            # 連接到第一個資料庫並抓取數據，排除時間戳欄位
            connection_1 = sqlite3.connect(model_1_db)
            query = """
            SELECT
                eav1.entity_id,
                t2.category,
                t2.display_name,
                t3.value
            FROM _objects_id AS t1
            JOIN _objects_eav AS eav1 ON t1.id = eav1.entity_id
            JOIN _objects_attr AS t2 ON eav1.attribute_id = t2.id
            JOIN _objects_val AS t3 ON eav1.value_id = t3.id
            """
            df1 = pd.read_sql_query(query, connection_1)
            connection_1.close()

            # 連接到第二個資料庫並抓取數據，排除時間戳欄位
            connection_2 = sqlite3.connect(model_2_db)
            df2 = pd.read_sql_query(query, connection_2)
            connection_2.close()

            # 將兩個 DataFrame 合併，並找出不一致的部分
            # merged_df = pd.merge(df1, df2, on=["entity_id", "attribute_id", "display_name"],
            #                      how="outer", suffixes=("_model_1", "_model_2"))
            merged_df = pd.merge(df1, df2, on=["entity_id", "category", "display_name"], suffixes=("_model_1", "_model_2"))
            # 比較 value 欄位，找出差異
            merged_df["value_diff"] = merged_df["value_model_1"] != merged_df["value_model_2"]

            # 只保留有差異的部分（value_diff為True）
            diff_df = merged_df[merged_df["value_diff"] == True]

            return diff_df

        except Exception as e:
            return f"發生錯誤: {e}"

    def get(self, request):
        path = os.path.join(Path(__file__).parent.parent.parent.parent, "media-root/database")

        # 連接到兩個 SQLite 資料庫
        model_1_db = f'{path}/TEST.rvt.db'
        model_2_db = f'{path}/TEST(刪除管線).rvt.db'

        print('start compare...')
        diff_df = self.compare_models_without_metadata(model_1_db, model_2_db)
        if isinstance(diff_df, pd.DataFrame) and not diff_df.empty:
            print("模型之間的差異：")
            print(diff_df)
        else:
            print(diff_df)

        # diff_dict = diff_df.to_dict(orient='records')

        return Response({'result': diff_df}, status=status.HTTP_200_OK)


@extend_schema(
    summary="BIM data import",
    description="Endpoint to import BIM data",
    tags=['APS']
)
class BimDataImportView(APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        client_id, client_secret = get_aps_credentials(request.user)
        bucket_key = get_aps_bucket(client_id, client_secret)

        file = request.FILES.get('file')
        if not file:
            return Response({"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)

        # check_redis('localhost')

        # Save file
        file_path = f'uploads/{file.name}'
        # if default_storage.exists(file_path):
        #     default_storage.delete(file_path)
        default_storage.save(file_path, ContentFile(file.read()))

        # 執行Autodesk Model Derivative API轉換
        bim_data_import.delay(client_id, client_secret, bucket_key, file.name, 'progress_group')
        # bim_data_import(client_id, client_secret, bucket_key, file.name, 'progress_group')

        # 記錄操作
        ip_address = request.META.get('REMOTE_ADDR')
        log_user_activity(self.request.user, '模型匯入', f'匯入{file.name}', 'SUCCESS', ip_address)

        # 回應上傳成功的訊息
        return Response({"message": f"File '{file.name}' is being processed."}, status=status.HTTP_200_OK)


@extend_schema(
    summary="BIM data reload",
    description="Endpoint to import BIM data",
    tags=['APS']
)
class BimDataReloadView(APIView):

    def post(self, request, *args, **kwargs):
        client_id, client_secret = get_aps_credentials(request.user)
        bucket_key = get_aps_bucket(client_id, client_secret)

        file_name = request.data.get('filename')
        if not file_name:
            return Response({"error": "No filename provided"}, status=status.HTTP_400_BAD_REQUEST)

        # 執行Autodesk Model Derivative API轉換
        bim_data_import.delay(client_id, client_secret, bucket_key, file_name, 'progress_group', True)
        # bim_data_import(client_id, client_secret, bucket_key, filename, 'progress_group', True)

        # 記錄操作
        ip_address = request.META.get('REMOTE_ADDR')
        log_user_activity(self.request.user, '模型匯入', f'重新匯入{file_name}', 'SUCCESS', ip_address)

        # 回應上傳成功的訊息
        return Response({"message": f"File '{file_name}' is being processed."}, status=status.HTTP_200_OK)


class BimUpdateCategoriesView(APIView):
    def post(self, request, *args, **kwargs):
        """
        POST 請求，異步更新多個檔案的 BimCategory 和 BimObject。
        處理所有 BimModel
        """

        # 獲取請求參數
        filenames = request.data.get('filenames')

        # 如果未提供 filenames，則處理所有 BimModel
        if not filenames:
            bim_models = models.BimModel.objects.all()
            if not bim_models:
                return Response({"error": "No BimModel found in the database."},
                                status=status.HTTP_404_NOT_FOUND)
            filenames = [model.name for model in bim_models]
        elif not isinstance(filenames, list):
            return Response({"error": "The 'filenames' parameter must be a list."},
                            status=status.HTTP_400_BAD_REQUEST)

        processed_files = []
        errors = []

        # 迴圈處理每個檔案
        for file_name in filenames:
            # 獲取最新的 BimConversion
            latest_conversion = models.BimConversion.objects.filter(
                bim_model__name=file_name
            ).order_by('-version').first()

            if not latest_conversion:
                errors.append(f"No BimConversion found for file_name '{file_name}'.")
                continue

            bim_conversion = latest_conversion

            # 確定 SQLite 檔案路徑
            sqlite_path = f"media-root/database/{file_name}.db"
            if not os.path.exists(sqlite_path):
                errors.append(f"SQLite file not found at: {sqlite_path}")
                continue

            # 提交 Celery 任務
            bim_update_categories.delay(sqlite_path, bim_conversion.id, file_name, 'update_category_group')
            processed_files.append({
                "file_name": file_name,
                "version": bim_conversion.version
            })

        # 回應結果
        response_data = {
            "message": f"Update tasks submitted for {len(processed_files)} files.",
            "processed_files": processed_files
        }
        if errors:
            response_data["errors"] = errors
            status_code = status.HTTP_207_MULTI_STATUS if processed_files else status.HTTP_400_BAD_REQUEST
        else:
            status_code = status.HTTP_202_ACCEPTED

        return Response(response_data, status=status_code)


class BimGroupViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = models.BimGroup.objects.filter(is_active=True).prefetch_related(
        Prefetch('bim_categories', queryset=models.BimCategory.objects.filter(
            is_active=True).select_related('conversion').order_by('value'))
    )
    serializer_class = serializers.BimGroupSerializer

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        response.data = [item for item in response.data if item is not None]
        return response


class BimModelViewSet(viewsets.ReadOnlyModelViewSet):
    """ 只查詢 BIMModel 及最新的 BimConversion """
    queryset = models.BimModel.objects.annotate(
        latest_version=Subquery(
            models.BimConversion.objects.filter(
                bim_model=OuterRef('id')
            ).order_by('-version').values('version')[:1]
        ),
        latest_urn=Subquery(
            models.BimConversion.objects.filter(
                bim_model=OuterRef('id')
            ).order_by('-version').values('urn')[:1]
        ),
        latest_original_file=Subquery(
            models.BimConversion.objects.filter(
                bim_model=OuterRef('id')
            ).order_by('-version').values('original_file')[:1]
        ),
        latest_svf_file=Subquery(
            models.BimConversion.objects.filter(
                bim_model=OuterRef('id')
            ).order_by('-version').values('svf_file')[:1]
        ),
        latest_conversion_created_at=Subquery(
            models.BimConversion.objects.filter(
                bim_model=OuterRef('id')
            ).order_by('-version').values('created_at')[:1]
        ),
    )

    serializer_class = serializers.BimModelSerializer

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        ip_address = request.META.get('REMOTE_ADDR')
        log_user_activity(self.request.user, '模型檢視', '查詢', 'SUCCESS', ip_address)
        return response


class StandardResultsSetPagination(pagination.PageNumberPagination):
    page_size = 10
    page_size_query_param = 'size'
    max_page_size = 100


class BimObjectViewSet(AutoPrefetchViewSetMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = serializers.BimObjectSerializer
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        request = self.request
        value = request.query_params.get('value', None)
        categories = request.query_params.get('category', None)

        if not value and not categories:
            raise ValidationError("請提供至少一個查詢參數 'value' 或 'category'。")

        filters = Q()
        if value:
            filters &= Q(value__icontains=value)

        if categories:
            try:
                category_list = json.loads(categories)
                category_qs = models.BimCategory.objects.filter(
                    Q(*[Q(bim_group_id=cat["bim_group"], value=cat["value"]) for cat in category_list])
                ).values_list("id", flat=True)
                filters &= Q(category_id__in=list(category_qs))
            except json.JSONDecodeError:
                raise ValidationError("category 參數格式錯誤，應為 JSON 陣列")

        latest_conversion = Subquery(
            models.BimConversion.objects.filter(
                bim_model=OuterRef('category__conversion__bim_model')
            ).order_by('-version').values('id')[:1]
        )

        return models.BimObject.objects.filter(
            filters,
            category__conversion__id__in=latest_conversion
        ).select_related(
            'category', 'category__bim_group', 'category__conversion', 'category__conversion__bim_model'
        ).prefetch_related(
            'category__bim_group', 'category__conversion__bim_model'
        )

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        ip_address = request.META.get('REMOTE_ADDR')
        log_user_activity(self.request.user, '圖資檢索',
                          f'查詢 {request.query_params.get("category")}; {request.query_params.get("value")}', 'SUCCESS', ip_address)
        return response


class BimModelWithCategoriesViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = models.BimModel.objects.all()
    serializer_class = serializers.BimModelWithCategoriesSerializer

    def get_queryset(self):
        print("get_queryset called")
        queryset = models.BimModel.objects.prefetch_related(
            Prefetch(
                'bim_conversions__bim_categories',
                queryset=models.BimCategory.objects.filter(is_active=True).select_related('bim_group'),
                to_attr='active_categories'
            )
        ).all()
        print("Queries executed:", len(connection.queries))
        return queryset

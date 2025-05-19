import os
import io
import re
import json
import sqlite3
import pandas as pd
import hashlib
import shutil
import logging

from pathlib import Path
from collections import defaultdict

from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.db.models import Subquery, OuterRef, Prefetch, Q
from django.http import FileResponse, StreamingHttpResponse


from django.db import connection
from django.contrib.postgres.aggregates import ArrayAgg, JSONBAgg
from django.db.models.functions import JSONObject
from django.core.cache import cache
from django.conf import settings

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

# 設定日誌記錄器
logger = logging.getLogger(__name__)

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
            return Response({"error": "未提供檔案"}, status=status.HTTP_400_BAD_REQUEST)

        # 檢查檔案名稱格式
        file_name = file.name
        if not re.match(r'^.{2}-.{4}-.{3}-.{2}-.{3}-.{2}-.{2}-.{5}', file_name):
            return Response(
                {"error": f"無效的檔案名稱格式：'{file_name}'。預期格式：XX-XXXX-XXX-XX-XXX-XX-XX-XXXXX"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 提取檔案主名稱（無副檔名）
        file_base_name = file_name.rsplit('.', 1)[0] if '.' in file_name else file_name
        file_extension = file_name.rsplit('.', 1)[1] if '.' in file_name else ''

        # 定義基本路徑
        base_path = 'uploads'
        # 檔案儲存目錄：uploads/{file_base_name}/
        file_dir = os.path.join(settings.MEDIA_ROOT, base_path, file_base_name).replace(os.sep, '/')
        # 檔案完整路徑：Uploads/{file_base_name}/{file_name}
        file_path = os.path.join(file_dir, file_name).replace(os.sep, '/')
        # 版本目錄：Uploads/{file_base_name}/ver
        ver_dir = os.path.join(file_dir, 'ver').replace(os.sep, '/')
        # default_storage 的相對路徑
        storage_file_path = f'{base_path}/{file_base_name}/{file_name}'

        # 檢查檔案是否存在並處理版本控制
        try:
            # 從 BimModel 取得當前版本
            bim_model = models.BimModel.objects.filter(name=file_name).first()
            current_version = bim_model.version if bim_model else 0

            if default_storage.exists(storage_file_path):
                # 建立檔案目錄和版本目錄
                os.makedirs(ver_dir, exist_ok=True)

                # 將現有檔案移至 ver 目錄並以版本號命名
                versioned_file_name = f"{file_base_name}_{current_version}.{file_extension}" if file_extension else f"{file_base_name}_{current_version}"
                versioned_file_path = os.path.join(ver_dir, versioned_file_name).replace(os.sep, '/')
                shutil.move(file_path, versioned_file_path)

            # 確保檔案目錄存在
            os.makedirs(file_dir, exist_ok=True)

            # 以原始名稱儲存新檔案
            default_storage.save(storage_file_path, ContentFile(file.read()))

        except Exception as e:
            return Response({"error": f"處理檔案版本時發生錯誤：{str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # 執行 Celery 任務
        bim_data_import.delay(client_id, client_secret, bucket_key, file_name, 'progress_group')

        # 記錄操作
        ip_address = request.META.get('REMOTE_ADDR')
        log_user_activity(self.request.user, '模型匯入', f'匯入{file_name}', 'SUCCESS', ip_address)

        # 回應成功訊息
        return Response({"message": f"檔案 '{file_name}' 正在處理中。"}, status=status.HTTP_200_OK)


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

         # 檢查檔案格式
        file_name = file_name
        if not re.match(r'^.{2}-.{4}-.{3}-.{2}-.{3}-.{2}-.{2}-.{5}', file_name):
            return Response(
                {"error": f"Invalid file name format: '{file_name}'. Expected format: XX-XXXX-XXX-XX-XXX-XX-XX-XXXXX"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 執行 Celery 任務
        bim_data_import.delay(client_id, client_secret, bucket_key, file_name, 'progress_group', True)

        # 記錄操作
        ip_address = request.META.get('REMOTE_ADDR')
        log_user_activity(self.request.user, '模型匯入', f'重新匯入{file_name}', 'SUCCESS', ip_address)

        # 回應處理中的訊息
        return Response({"message": f"File '{file_name}' is being processed."}, status=status.HTTP_200_OK)


class BimUpdateCategoriesView(APIView):
    def post(self, request, *args, **kwargs):
        """
        POST 請求，異步更新多個檔案的 BimCategory 和 BimObject。
        處理所有 BimModel
        """
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

        for file_name in filenames:
            try:
                bim_model = models.BimModel.objects.get(name=file_name)
            except models.BimModel.DoesNotExist:
                errors.append(f"No BimModel found for file_name '{file_name}'.")
                continue

            if not bim_model.sqlite_path:
                errors.append(f"SQLite path not set for BimModel '{file_name}'.")
                continue

            # 將 sqlite_path 與 MEDIA_ROOT 結合，形成絕對路徑
            absolute_sqlite_path = os.path.join(settings.MEDIA_ROOT, bim_model.sqlite_path)

            # 使用絕對路徑檢查檔案
            if not os.path.exists(absolute_sqlite_path):
                errors.append(f"SQLite file not found at: {absolute_sqlite_path}")
                continue

            # 提交 Celery 任務，使用絕對路徑
            bim_update_categories.delay(absolute_sqlite_path, bim_model.id, file_name, 'update_category_group')
            processed_files.append({
                "file_name": file_name,
                "version": bim_model.version
            })

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


class BimConditionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = serializers.BimConditionSerializer
    # Preload all active conditions and their categories
    queryset = models.BimCondition.objects.filter(is_active=True).order_by('order').prefetch_related(
        'bim_categories',
        Prefetch('children', queryset=models.BimCondition.objects.all().order_by('order'))
    )

    def list(self, request, *args, **kwargs):
        root_nodes = self.get_queryset().filter(level=0)
        serializer = self.get_serializer(root_nodes, many=True)
        return Response(serializer.data)


class BimRegionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = serializers.BimRegionSerializer
    queryset = models.BimRegion.objects.all().select_related('zone', 'bim_model')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()

        # 按 zone_id 分組並構建樹狀結構
        zone_groups = {}
        for region in queryset:
            zone = region.zone
            zone_key = zone.id
            if zone_key not in zone_groups:
                zone_groups[zone_key] = {
                    'key': zone.id,
                    'label': zone.description,
                    'code': zone.code,
                    'levels': {}
                }

            level = region.level
            if level not in zone_groups[zone_key]['levels']:
                zone_groups[zone_key]['levels'][level] = []

            zone_groups[zone_key]['levels'][level].append({
                'bim_model_id': region.bim_model_id,
                'dbid': region.dbid
            })

        # 構建樹狀數據
        tree_data = []
        for zone_key, group in sorted(zone_groups.items(), key=lambda x: x[1]['code']):
            levels_data = [
                {
                    'key': level,
                    'label': level,
                    'data': models
                }
                for level, models in sorted(group['levels'].items())
            ]
            tree_data.append({
                'key': group['key'],
                'label': group['label'],
                'code': group['code'],
                'children': levels_data
            })

        serializer = self.get_serializer(tree_data, many=True)
        return Response(serializer.data)


class BimModelViewSet(viewsets.ReadOnlyModelViewSet):
    """ 只查詢 BIMModel """
    queryset = models.BimModel.objects.all()  # 直接查詢 BimModel，不依賴 BimConversion
    serializer_class = serializers.BimModelSerializer

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        ip_address = request.META.get('REMOTE_ADDR')
        log_user_activity(self.request.user, '模型檢視', '查詢', 'SUCCESS', ip_address)
        return response


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'size'
    max_page_size = 100

    def get_page_number(self, request, paginator):
        """從 request.data 或 request.query_params 獲取 page"""
        if request.method == 'POST':
            page = request.data.get('page', 1)
        else:
            page = request.query_params.get(self.page_query_param, 1)
        try:
            return int(page)
        except (ValueError, TypeError):
            return 1

    def get_page_size(self, request, paginator=None):
        """從 request.data 或 request.query_params 獲取 size"""
        if request.method == 'POST':
            size = request.data.get(self.page_size_query_param, self.page_size)
        else:
            size = request.query_params.get(self.page_size_query_param, self.page_size)
        try:
            if self.max_page_size and int(size) > self.max_page_size:
                return self.max_page_size
            return int(size)
        except (ValueError, TypeError):
            return self.page_size


class BimObjectViewSet(AutoPrefetchViewSetMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = serializers.BimObjectSerializer
    pagination_class = StandardResultsSetPagination

    def list(self, request, *args, **kwargs):
        raise ValidationError({
            "detail": "此端點僅支援 POST 請求，請使用 POST 方法查詢資料。",
            "code": "method_not_allowed"
        })

    def create(self, request, *args, **kwargs):
        regions = request.data.get('regions', request.data.get('zones', None))
        categories = request.data.get('categories', None)
        fuzzy_keyword = request.data.get('fuzzy_keyword', None)

        if not (regions or categories or fuzzy_keyword):
            raise ValidationError({
                "detail": "請提供至少一個查詢參數 'regions'、'categories' 或 'fuzzy_keyword'。",
                "code": "missing_parameters"
            })

        # 快取完整結果
        query_data = {k: v for k, v in request.data.items() if k not in ['page', 'size']}
        query_key = hashlib.md5(str(query_data).encode()).hexdigest()
        cached_results = cache.get(query_key)
        if cached_results:
            paginator = self.pagination_class()
            page_queryset = paginator.paginate_queryset(cached_results, request)
            serializer = self.get_serializer(page_queryset, many=True)
            return paginator.get_paginated_response(serializer.data)

        filters = Q()
        hierarchy_dbids = []
        valid_bim_models = set()

        # 處理 regions
        if regions:
            if not isinstance(regions, list):
                raise ValidationError({
                    "regions": "必須是列表。",
                    "code": "invalid_regions_format"
                })
            if not regions:
                raise ValidationError({
                    "regions": "不能為空列表。",
                    "code": "empty_regions"
                })

            for region in regions:
                bim_model = region.get('bim_model')
                dbids = region.get('dbids')
                if not isinstance(bim_model, int):
                    raise ValidationError({
                        "bim_model": f"必須是整數，收到：{bim_model}",
                        "code": "invalid_bim_model"
                    })
                if not isinstance(dbids, list) or not all(isinstance(dbid, int) for dbid in dbids):
                    raise ValidationError({
                        "dbids": f"必須是整數列表，收到：{dbids}",
                        "code": "invalid_dbids_format"
                    })
                if not dbids:
                    raise ValidationError({
                        "dbids": f"不能為空列表，bim_model：{bim_model}",
                        "code": "empty_dbids"
                    })
                valid_bim_models.add(bim_model)
                if not models.BimModel.objects.filter(id=bim_model).exists():
                    raise ValidationError({
                        "bim_model": f"無效的 bim_model：{bim_model}",
                        "code": "invalid_bim_model_id"
                    })

                # 分批處理 dbids
                batch_size = 5
                for i in range(0, len(dbids), batch_size):
                    batch_dbids = dbids[i:i + batch_size]
                    cache_key = f"hierarchy_{bim_model}_{hashlib.md5(str(sorted(batch_dbids)).encode()).hexdigest()}"
                    cached_dbids = cache.get(cache_key)
                    if cached_dbids:
                        hierarchy_dbids.extend(cached_dbids)
                        continue
                    with connection.cursor() as cursor:
                        cursor.execute("""
                            WITH RECURSIVE hierarchy AS (
                                SELECT entity_id, 1 AS depth
                                FROM forge_bim_object_hierarchy
                                WHERE bim_model_id = %s AND parent_id = ANY(%s)
                                UNION
                                SELECT h.entity_id, hr.depth + 1
                                FROM forge_bim_object_hierarchy h
                                INNER JOIN hierarchy hr ON h.parent_id = hr.entity_id
                                WHERE h.bim_model_id = %s AND hr.depth < 5
                            )
                            SELECT entity_id FROM hierarchy
                            WHERE depth <= 5
                            UNION
                            SELECT unnest(%s) AS entity_id
                        """, [bim_model, batch_dbids, bim_model, batch_dbids])
                        result = cursor.fetchall()
                        new_dbids = [row[0] for row in result]
                        if len(new_dbids) > 10000:
                            raise ValidationError({
                                "dbids": f"查詢結果過大，hierarchy_dbids 數量：{len(new_dbids)}，請選擇較少節點",
                                "code": "hierarchy_too_large"
                            })
                        hierarchy_dbids.extend(new_dbids)
                        cache.set(cache_key, new_dbids, timeout=3600)

            hierarchy_dbids = list(set(hierarchy_dbids))
            if hierarchy_dbids:
                filters &= Q(dbid__in=hierarchy_dbids)
            else:
                filters &= Q(dbid__in=[])

        # 處理 categories
        value_filters = Q()
        if categories:
            if not isinstance(categories, list):
                raise ValidationError({
                    "categories": "必須是列表。",
                    "code": "invalid_categories_format"
                })
            if not categories:
                raise ValidationError({
                    "categories": "不能為空列表。",
                    "code": "empty_categories"
                })
            for item in categories:
                if not isinstance(item, dict):
                    raise ValidationError({
                        "categories": f"元素必須是物件，收到：{item}",
                        "code": "invalid_category_item"
                    })
                display_name = item.get('display_name')
                value = item.get('value')
                if not isinstance(display_name, str) or not display_name.strip():
                    raise ValidationError({
                        "display_name": f"必須是非空字串，收到：{display_name}",
                        "code": "invalid_display_name"
                    })
                if not isinstance(value, str) or not value.strip():
                    raise ValidationError({
                        "value": f"必須是非空字串，收到：{value}",
                        "code": "invalid_value"
                    })
                # 不檢查 bim_model，僅基於 display_name 和 value 構建條件
                value_filters |= (
                    Q(display_name=display_name) &
                    Q(value=value)
                )

        # 處理 fuzzy_keyword
        fuzzy_filters = Q()
        if fuzzy_keyword:
            if not isinstance(fuzzy_keyword, str):
                raise ValidationError({
                    "fuzzy_keyword": "必須是字串。",
                    "code": "invalid_fuzzy_keyword"
                })
            if not fuzzy_keyword.strip():
                raise ValidationError({
                    "fuzzy_keyword": "不能為空字串。",
                    "code": "empty_fuzzy_keyword"
                })
            fuzzy_filters = (Q(value__trigram_similar=fuzzy_keyword) | Q(value__contains=fuzzy_keyword))

        # 結合 filters
        if value_filters and fuzzy_filters:
            filters &= (value_filters | fuzzy_filters)
        elif value_filters:
            filters &= value_filters
        elif fuzzy_filters:
            filters &= fuzzy_filters

        # 僅對 regions 應用 bim_model_id 限制
        if valid_bim_models:
            filters &= Q(bim_model_id__in=valid_bim_models)

        queryset = models.BimObject.objects.filter(filters).select_related('bim_model').values(
            'id',
            'dbid',
            'value',
            'display_name',
            'bim_model__name',
            'bim_model__version',
            'bim_model__urn',
            'bim_model__svf_path',
            'bim_model__sqlite_path'
        ).order_by('bim_model', 'dbid')

        # 快取結果
        results = list(queryset)
        cache.set(query_key, results, timeout=300)

        paginator = self.pagination_class()
        page_queryset = paginator.paginate_queryset(results, request)
        serializer = self.get_serializer(page_queryset, many=True)
        response = paginator.get_paginated_response(serializer.data)

        ip_address = request.META.get('REMOTE_ADDR')
        log_regions = f"regions: {regions[:10]}" if regions else ""
        log_cats = f"categories: {categories[:10]}" if categories else ""
        log_fuzzy = f"fuzzy_keyword: {fuzzy_keyword}" if fuzzy_keyword else ""
        log_message = f"查詢 {log_regions}{' ; ' if log_regions else ''}{log_cats}{' ; ' if log_cats else ''}{log_fuzzy}"
        log_user_activity(self.request.user, '圖資檢索', log_message, 'SUCCESS', ip_address)
        return response


class BimVersionDownloadView(APIView):
    def get(self, request, *args, **kwargs):
        # 取得請求參數
        file_name = request.query_params.get('file_name')
        version = request.query_params.get('version')

        # 驗證輸入
        if not file_name or not version:
            return Response(
                {"error": "必須提供 file_name 和 version 參數"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 檢查檔案名稱格式
        if not re.match(r'^.{2}-.{4}-.{3}-.{2}-.{3}-.{2}-.{2}-.{5}', file_name):
            return Response(
                {"error": f"無效的檔案名稱格式：'{file_name}'。預期格式：XX-XXXX-XXX-XX-XXX-XX-XX-XXXXX"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 檢查版本號是否為正整數
        try:
            version = int(version)
            if version <= 0:
                raise ValueError
        except ValueError:
            return Response(
                {"error": "版本號必須為正整數"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 提取檔案主名稱和副檔名
        file_base_name = file_name.rsplit('.', 1)[0] if '.' in file_name else file_name
        file_extension = file_name.rsplit('.', 1)[1] if '.' in file_name else ''

        # 構建版本檔案路徑
        base_path = 'Uploads'
        ver_dir = os.path.join(settings.MEDIA_ROOT, base_path, file_base_name, 'ver').replace(os.sep, '/')
        versioned_file_name = f"{file_base_name}_{version}.{file_extension}" if file_extension else f"{file_base_name}_{version}"
        versioned_file_path = os.path.join(ver_dir, versioned_file_name).replace(os.sep, '/')
        storage_versioned_file_path = f'{base_path}/{file_base_name}/ver/{versioned_file_name}'

        # 檢查檔案是否存在
        if not default_storage.exists(storage_versioned_file_path):
            return Response(
                {"error": f"版本 {version} 的檔案 '{file_name}' 不存在"},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            # 開啟檔案並回傳 FileResponse
            file = default_storage.open(storage_versioned_file_path, 'rb')
            response = FileResponse(file, as_attachment=True, filename=file_name)
            return response
        except Exception as e:
            return Response(
                {"error": f"下載檔案時發生錯誤：{str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class BimCobieObjectViewSet(AutoPrefetchViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = models.BimObject.objects.all()

    def list(self, request, *args, **kwargs):
        try:
            file_name = self.request.query_params.get('file_name', None)

            # 如果未提供 file_name，返回錯誤訊息
            if not file_name:
                return Response(
                    {"error": "請提供 file_name 查詢參數"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 構建 CSV 檔案名稱：去掉副檔名後串接 .csv
            csv_filename = f"{os.path.splitext(file_name)[0]}.csv"

            # 構建查詢：先找出符合 file_name 的 BimModel IDs
            bim_model_ids = models.BimModel.objects.filter(
                name__icontains=file_name
            ).values_list('id', flat=True)

            # 檢查是否有匹配的 BimModel
            if not bim_model_ids:
                return Response(
                    {"message": "沒有找到匹配 file_name 的 BimModel"},
                    status=status.HTTP_404_NOT_FOUND
                )

            # 查詢 BimObject，確保 display_name 包含 COBie，並按 dbid 排序
            queryset = models.BimObject.objects.filter(
                display_name__icontains='COBie',
                bim_model_id__in=bim_model_ids
            ).order_by('dbid', 'display_name')

            # 檢查是否有匹配的 BimObject
            if not queryset.exists():
                # 返回空的 CSV 檔案
                buffer = io.BytesIO()
                buffer.write('dbid,display_name,value\n'.encode('utf-8-sig'))
                buffer.seek(0)
                return FileResponse(
                    buffer,
                    as_attachment=True,
                    filename=csv_filename,
                    content_type='text/csv'
                )

            # 選擇需要的欄位，減少記憶體使用
            queryset = queryset.select_related('bim_model').values(
                'dbid', 'display_name', 'value'
            )

            # 分塊生成 CSV
            buffer = io.BytesIO()
            first_chunk = True
            chunk_size = 10000
            chunk_data = []
            for record in queryset:  # 直接迭代 queryset，避免 iterator() 的單筆問題
                chunk_data.append(record)
                if len(chunk_data) >= chunk_size:
                    # 處理一批資料
                    df = pd.DataFrame.from_records(chunk_data)
                    df.columns = ['dbid', 'display_name', 'value']
                    if first_chunk:
                        df.to_csv(buffer, index=False, encoding='utf-8-sig')
                        first_chunk = False
                    else:
                        df.to_csv(buffer, index=False, encoding='utf-8-sig', header=False)
                    chunk_data = []  # 清空 chunk

            # 處理剩餘的資料（如果有）
            if chunk_data:
                df = pd.DataFrame.from_records(chunk_data)
                df.columns = ['dbid', 'display_name', 'value']
                if first_chunk:
                    df.to_csv(buffer, index=False, encoding='utf-8-sig')
                else:
                    df.to_csv(buffer, index=False, encoding='utf-8-sig', header=False)

            # 如果沒有資料（例如所有 chunk 為空），返回空 CSV
            if first_chunk:
                buffer.write('dbid,display_name,value\n'.encode('utf-8-sig'))
            print('check-->')
            buffer.seek(0)
            return FileResponse(
                buffer,
                as_attachment=True,
                filename=csv_filename,
                content_type='text/csv'
            )

        except Exception as e:
            # 記錄錯誤日誌
            logger.error(f"Error generating CSV: {str(e)}", exc_info=True)
            # 返回錯誤訊息給前端
            return Response(
                {"error": "伺服器內部錯誤，請聯繫管理員"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

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
from django.db.models import Subquery, OuterRef, Prefetch, Q, F, Value, CharField
from django.http import FileResponse, StreamingHttpResponse
from django.utils.encoding import smart_str

from django.db import connection, transaction
from django.contrib.postgres.aggregates import ArrayAgg, JSONBAgg
from django.db.models.functions import JSONObject, Coalesce
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
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAdminUser

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
    permission_classes = (IsAuthenticated,)

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
    permission_classes = (IsAuthenticated,)

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
    permission_classes = (IsAuthenticated,)

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
            if name is None:
                return Response({'error': 'Name is required'}, status=400)

            # 防止路徑遍歷
            if '..' in name or name.startswith('/') or name.startswith('\\'):
                return Response({'error': 'Invalid file name'}, status=400)
            
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
    permission_classes = (IsAuthenticated,)

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
    permission_classes = (IsAuthenticated,)

    def post(self, request, *args, **kwargs):
        client_id, client_secret = get_aps_credentials(request.user)
        bucket_key = get_aps_bucket(client_id, client_secret)

        file = request.FILES.get('file')
        if not file:
            return Response({"error": "未提供檔案"}, status=status.HTTP_400_BAD_REQUEST)

        # 檢查檔案名稱格式
        file_name = file.name
        if not re.match(r'^([^-\n]+-){7}[^-\n]+$', file_name):
            return Response(
                {"error": f"無效的檔案名稱格式：'{file_name}'。預期格式：XX-XXXX-XXX-XX-XXX-XX-XX-XXXXX"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 從 BimModel 取得版本號
        with transaction.atomic():
            bim_model = models.BimModel.objects.select_for_update().filter(name=file_name).first()
            version = bim_model.version + 1 if bim_model else 1

        # 定義基本路徑
        base_path = 'uploads'
        # 檔案儲存目錄：Uploads/{file_name}/ver_{version}/
        file_dir = os.path.join(settings.MEDIA_ROOT, base_path, file_name, f"ver_{version}").replace(os.sep, '/')
        # default_storage 的相對路徑
        storage_file_path = f'{base_path}/{file_name}/ver_{version}/{file_name}'

        # 清理舊版本的 uploads 目錄（僅保留前一版）
        uploads_base_dir = os.path.join(settings.MEDIA_ROOT, base_path, file_name).replace(os.sep, '/')
        if version > 2:
            for v in range(1, version - 1):  # 僅保留 version - 1
                old_ver_dir = os.path.join(uploads_base_dir, f"ver_{v}").replace(os.sep, '/')
                if os.path.exists(old_ver_dir):
                    try:
                        shutil.rmtree(old_ver_dir)
                        logger.info(f"Removed old uploads directory: {old_ver_dir}")
                    except Exception as e:
                        logger.warning(f"Failed to remove old uploads directory {old_ver_dir}: {str(e)}")

        # 檢查檔案是否存在並處理版本控制
        try:
            # 確保檔案目錄存在
            os.makedirs(file_dir, exist_ok=True)

            # 清除目標版本中的同名檔案（避免流水號）
            if default_storage.exists(storage_file_path):
                try:
                    default_storage.delete(storage_file_path)
                    logger.info(f"Removed existing file at {storage_file_path} to avoid duplicates")
                except Exception as e:
                    logger.warning(f"Failed to remove existing file at {storage_file_path}: {str(e)}")

            # 以原始名稱儲存新檔案
            default_storage.save(storage_file_path, ContentFile(file.read()))

        except Exception as e:
            return Response({"error": f"處理檔案版本時發生錯誤：{str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # 執行 Celery 任務 (传递 user_id 作为位置参数)
        bim_data_import.delay(client_id, client_secret, bucket_key, file_name, 'progress_group', request.user.id)

        # 記錄操作
        ip_address = request.META.get('REMOTE_ADDR')
        log_user_activity(self.request.user, '模型匯入', f'匯入{file_name}', 'SUCCESS', ip_address)

        # 回應成功訊息
        return Response({"message": f"檔案 '{file_name}' 正在處理中。"}, status=status.HTTP_200_OK)


class BimDataRevertView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, *args, **kwargs):
        file_name = request.data.get('file_name')
        if not file_name:
            return Response({"error": "未提供檔案名稱"}, status=status.HTTP_400_BAD_REQUEST)

        # 檢查檔案名稱格式
        if not re.match(r'^([^-\n]+-){7}[^-\n]+$', file_name):
            return Response(
                {"error": f"無效的檔案名稱格式：'{file_name}'。預期格式：XX-XXXX-XXX-XX-XXX-XX-XX-XXXXX"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 使用資料庫鎖定取得 BimModel
        bim_model = models.BimModel.objects.filter(name=file_name).first()
        if not bim_model:
            return Response({"error": f"未找到檔案 '{file_name}' 的 BimModel"}, status=status.HTTP_404_NOT_FOUND)

        current_version = bim_model.version
        if current_version <= 1:
            return Response({"error": "已是第一版，無法回覆前一版"}, status=status.HTTP_400_BAD_REQUEST)

        target_version = current_version - 1
        new_version = current_version + 1

        # 檢查前一版檔案是否存在
        uploads_path = f"uploads/{file_name}/ver_{target_version}/{file_name}"
        svf_dir = os.path.join(settings.MEDIA_ROOT, "svf", file_name, f"ver_{target_version}").replace(os.sep, '/')
        sqlite_path = f"sqlite/{file_name}/ver_{target_version}/{file_name}.db"

        if not default_storage.exists(uploads_path):
            return Response({"error": f"前一版 (v{target_version}) 的上傳檔案缺失"}, status=status.HTTP_400_BAD_REQUEST)
        if not os.path.exists(svf_dir):
            return Response({"error": f"前一版 (v{target_version}) 的 SVF 目錄缺失"}, status=status.HTTP_400_BAD_REQUEST)
        if not default_storage.exists(sqlite_path):
            return Response({"error": f"前一版 (v{target_version}) 的 SQLite 檔案缺失"}, status=status.HTTP_400_BAD_REQUEST)

        # 定義新版本的路徑
        new_uploads_dir = os.path.join(settings.MEDIA_ROOT, "uploads", file_name, f"ver_{new_version}").replace(os.sep, '/')
        new_svf_dir = os.path.join(settings.MEDIA_ROOT, "svf", file_name, f"ver_{new_version}").replace(os.sep, '/')
        new_sqlite_dir = os.path.join(settings.MEDIA_ROOT, "sqlite", file_name, f"ver_{new_version}").replace(os.sep, '/')
        new_sqlite_path = f"sqlite/{file_name}/ver_{new_version}/{file_name}.db"
        new_uploads_path = f"uploads/{file_name}/ver_{new_version}/{file_name}"

        # 複製前一版檔案到新版本
        try:
            os.makedirs(new_uploads_dir, exist_ok=True)
            shutil.copy2(
                os.path.join(settings.MEDIA_ROOT, uploads_path).replace(os.sep, '/'),
                os.path.join(new_uploads_dir, file_name).replace(os.sep, '/')
            )
            logger.info(f"Copied uploads from {uploads_path} to {new_uploads_path}")

            if os.path.exists(new_svf_dir):
                shutil.rmtree(new_svf_dir)
            shutil.copytree(svf_dir, new_svf_dir)
            logger.info(f"Copied svf from {svf_dir} to {new_svf_dir}")

            os.makedirs(new_sqlite_dir, exist_ok=True)
            shutil.copy2(
                os.path.join(settings.MEDIA_ROOT, sqlite_path).replace(os.sep, '/'),
                os.path.join(new_sqlite_dir, f"{file_name}.db").replace(os.sep, '/')
            )
            logger.info(f"Copied sqlite from {sqlite_path} to {new_sqlite_path}")
        except Exception as e:
            logger.error(f"Failed to copy files for {file_name} to v{new_version}: {str(e)}")
            return Response({"error": f"複製檔案到新版本時發生錯誤：{str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # 尋找新版本的 .svf 檔案
        svf_files = []
        for root, _, files in os.walk(new_svf_dir):
            for file in files:
                if file.endswith('.svf'):
                    absolute_svf_path = os.path.join(root, file).replace(os.sep, '/')
                    svf_files.append(absolute_svf_path)
        if not svf_files:
            return Response({"error": f"新版本 (v{new_version}) 的 SVF 檔案缺失"}, status=status.HTTP_400_BAD_REQUEST)

        selected_svf_path = svf_files[0]
        new_svf_path = os.path.relpath(selected_svf_path, settings.MEDIA_ROOT).replace(os.sep, '/')
        if len(svf_files) > 1:
            logger.warning(f"Multiple .svf files found in {new_svf_dir}: {svf_files}. Using {new_svf_path}.")

        # 更新 BimModel
        bim_model.version = new_version
        bim_model.svf_path = new_svf_path
        bim_model.sqlite_path = new_sqlite_path
        bim_model.save()

        # 重新轉換前一版的關聯資料
        absolute_sqlite_path = os.path.join(settings.MEDIA_ROOT, new_sqlite_path).replace(os.sep, '/')
        bim_update_categories.delay(absolute_sqlite_path, bim_model.id, file_name, 'update_category_group', 'update.category')

        # 執行檔案清理邏輯
        uploads_base_dir = os.path.join(settings.MEDIA_ROOT, "uploads", file_name).replace(os.sep, '/')
        svf_base_dir = os.path.join(settings.MEDIA_ROOT, "svf", file_name).replace(os.sep, '/')
        sqlite_base_dir = os.path.join(settings.MEDIA_ROOT, "sqlite", file_name).replace(os.sep, '/')

        if new_version > 2:
            for v in range(1, new_version - 1):
                old_uploads_dir = os.path.join(uploads_base_dir, f"ver_{v}").replace(os.sep, '/')
                if os.path.exists(old_uploads_dir):
                    try:
                        shutil.rmtree(old_uploads_dir)
                        logger.info(f"Removed old uploads directory: {old_uploads_dir}")
                    except Exception as e:
                        logger.warning(f"Failed to remove old uploads directory {old_uploads_dir}: {str(e)}")

                old_svf_dir = os.path.join(svf_base_dir, f"ver_{v}").replace(os.sep, '/')
                if os.path.exists(old_svf_dir):
                    try:
                        shutil.rmtree(old_svf_dir)
                        logger.info(f"Removed old svf directory: {old_svf_dir}")
                    except Exception as e:
                        logger.warning(f"Failed to remove old svf directory {old_svf_dir}: {str(e)}")

                old_sqlite_dir = os.path.join(sqlite_base_dir, f"ver_{v}").replace(os.sep, '/')
                if os.path.exists(old_sqlite_dir):
                    try:
                        shutil.rmtree(old_sqlite_dir)
                        logger.info(f"Removed old sqlite directory: {old_sqlite_dir}")
                    except Exception as e:
                        logger.warning(f"Failed to remove old sqlite directory {old_sqlite_dir}: {str(e)}")

        # 記錄操作
        ip_address = request.META.get('REMOTE_ADDR')
        log_user_activity(self.request.user, '模型回覆',
                          f'回覆 {file_name} 到 v{target_version} (儲存為 v{new_version})', 'SUCCESS', ip_address)

        return Response({"message": f"成功回覆檔案 '{file_name}' 到版本 v{target_version} (儲存為 v{new_version})"}, status=status.HTTP_200_OK)


@extend_schema(
    summary="BIM data reload",
    description="Endpoint to import BIM data",
    tags=['APS']
)
class BimDataReloadView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, *args, **kwargs):
        client_id, client_secret = get_aps_credentials(request.user)
        bucket_key = get_aps_bucket(client_id, client_secret)

        file_name = request.data.get('filename')
        if not file_name:
            return Response({"error": "No filename provided"}, status=status.HTTP_400_BAD_REQUEST)

        # 檢查檔案格式
        file_name = file_name
        if not re.match(r'^([^-\n]+-){7}[^-\n]+$', file_name):
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
    permission_classes = (IsAuthenticated,)

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
            bim_update_categories.delay(absolute_sqlite_path, bim_model.id, file_name, 'update_category_group', 'update.category')
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
    permission_classes = (IsAuthenticated,)
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
    permission_classes = (IsAuthenticated,)
    serializer_class = serializers.BimRegionSerializer
    # queryset = models.BimRegion.objects.all().select_related('zone', 'role', 'bim_model')
    queryset = models.BimRegion.objects \
        .select_related('zone', 'role', 'bim_model') \
        .filter(zone__isnull=False, role__isnull=False) \
        .order_by('zone__code', 'role__code', 'level')

    # 樹狀結構:分區(zone)->空間/系統(role)->樓層(level)
    def list(self, request, *args, **kwargs):
        # 查詢所有 BimRegion 記錄，不過濾
        queryset = self.get_queryset().order_by('zone__id', 'role__code', 'level')

        # 按 zone_id 分組
        zone_groups = {}
        for region in queryset:
            zone = region.zone
            role = region.role
            zone_key = zone.id
            role_key = region.role_id

            # 初始化區域層
            if zone_key not in zone_groups:
                zone_groups[zone_key] = {
                    'label': f'{zone.description} ({zone.code})',
                    'id': zone.id,
                    'code': zone.code,
                    'children': {}
                }

            # 初始化角色層
            if role_key not in zone_groups[zone_key]['children']:
                print(role)
                zone_groups[zone_key]['children'][role_key] = {
                    'label': f'{role.description} ({role.code})',
                    'id': role.id,
                    'code': role.code,
                    'children': []
                }

            # 添加樓層，過濾包含 'XX' 的 level
            if 'XX' not in region.level:
                zone_groups[zone_key]['children'][role_key]['children'].append({
                    'label': region.level,
                    'id': region.id
                })

        # 構建三層結構
        tree_data = []
        for zone_id in sorted(zone_groups.keys()):
            zone_data = zone_groups[zone_id]
            roles_data = []
            for role_id in sorted(zone_groups[zone_id]['children'].keys(), key=lambda x: x or float('inf')):
                role_data = zone_groups[zone_id]['children'][role_id]
                # 移除重複樓層
                unique_levels = {level['id']: level for level in role_data['children']}.values()
                role_data['children'] = sorted(unique_levels, key=lambda x: x['id'])
                # 只添加有角色資料的 role（即使 children 為空）
                roles_data.append(role_data)
            zone_data['children'] = roles_data
            tree_data.append(zone_data)

        return Response(tree_data)    


class BimModelViewSet(viewsets.ReadOnlyModelViewSet):
    """ 只查詢 BIMModel """
    permission_classes = (IsAuthenticated,)
    queryset = models.BimModel.objects.all().order_by('-created_at')  # 直接查詢 BimModel，不依賴 BimConversion
    serializer_class = serializers.BimModelSerializer
    pagination_class = StandardResultsSetPagination

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        ip_address = request.META.get('REMOTE_ADDR')
        log_user_activity(self.request.user, '模型檢視', '查詢', 'SUCCESS', ip_address)
        return response


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'size'
    max_page_size = 1000

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
    permission_classes = (IsAuthenticated,)
    serializer_class = serializers.BimObjectSerializer
    pagination_class = StandardResultsSetPagination

    def list(self, request, *args, **kwargs):
        raise ValidationError({
            "detail": "此端點僅支援 POST 請求，請使用 POST 方法查詢資料。",
            "code": "method_not_allowed"
        })

    # 取得基本查詢分頁結果
    def create(self, request, *args, **kwargs):
        regions = request.data.get('regions', request.data.get('zones', None))
        categories = request.data.get('categories', None)
        fuzzy_keyword = request.data.get('fuzzy_keyword', None)

        if not regions:
            raise ValidationError({
                "detail": "請提供 'regions' 參數。",
                "code": "missing_regions"
            })

        # 驗證 regions
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

        # 處理 fuzzy_keyword
        if fuzzy_keyword:
            if not isinstance(fuzzy_keyword, dict):
                raise ValidationError({
                    "fuzzy_keyword": "必須是物件，包含 label 和 display_name。",
                    "code": "invalid_fuzzy_keyword_format"
                })
            label = fuzzy_keyword.get('label')
            # 若 label 為空字串或 null，視為 fuzzy_keyword 未提供
            if label is None or (isinstance(label, str) and not label.strip()):
                fuzzy_keyword = None

        # 快取查詢參數
        query_data = {k: v for k, v in request.data.items() if k not in ['page', 'size']}
        query_key = hashlib.md5(str(query_data).encode()).hexdigest()
        cached_results = cache.get(query_key)
        if cached_results:
            paginator = self.pagination_class()
            page_queryset = paginator.paginate_queryset(cached_results, request)
            serializer = self.get_serializer(page_queryset, many=True)
            return paginator.get_paginated_response(serializer.data)

        valid_bim_models = set()
        region_dbids = set()
        region_values = set()

        # 處理 regions
        for region in regions:
            zone_id = region.get('zone_id')
            role_id = region.get('role_id')
            level = region.get('level')

            # 如果 zone_id, role_id, level 都是 None，跳過這個 region
            if zone_id is None and role_id is None and level is None:
                continue

            if zone_id is not None and not isinstance(zone_id, int):
                raise ValidationError({
                    "zone_id": f"必須是整數或 null，收到：{zone_id}",
                    "code": "invalid_zone_id"
                })
            if role_id is not None and not isinstance(role_id, int):
                raise ValidationError({
                    "role_id": f"必須是整數或 null，收到：{role_id}",
                    "code": "invalid_role_id"
                })
            if level is not None and not isinstance(level, str):
                raise ValidationError({
                    "level": f"必須是字串或 null，收到：{level}",
                    "code": "invalid_level"
                })

            # 查詢 BimRegion
            bim_region_qs = models.BimRegion.objects.all()
            if zone_id is not None:
                bim_region_qs = bim_region_qs.filter(zone_id=zone_id)
            if role_id is not None:
                bim_region_qs = bim_region_qs.filter(role_id=role_id)
            if level is not None:
                bim_region_qs = bim_region_qs.filter(level=level)

            bim_regions = bim_region_qs.values('bim_model_id', 'dbid', 'value')

            if not bim_regions.exists():
                raise ValidationError({
                    "regions": f"無效的組合：zone_id={zone_id}, role_id={role_id}, level={level}",
                    "code": "invalid_region_combination"
                })

            for bim_region in bim_regions:
                bim_model_id = bim_region['bim_model_id']
                dbid = bim_region['dbid']
                value = bim_region['value'].strip()
                if not models.BimModel.objects.filter(id=bim_model_id).exists():
                    raise ValidationError({
                        "bim_model_id": f"無效的 bim_model_id：{bim_model_id}",
                        "code": "invalid_bim_model_id"
                    })
                valid_bim_models.add(bim_model_id)
                region_dbids.add(dbid)
                region_values.add(value)

        # 定義查詢條件
        filters = Q()
        if not categories and not fuzzy_keyword:
            # 僅 regions：保持原有邏輯，僅查詢根節點
            if region_dbids and valid_bim_models and region_values:
                filters &= Q(dbid__in=region_dbids) & Q(bim_model_id__in=valid_bim_models) & Q(
                    display_name="Name") & Q(value__in=region_values)
            else:
                filters &= Q(dbid__in=[])
        else:
            # 包含 categories 或 fuzzy_keyword：使用 root_dbid 過濾
            if valid_bim_models:
                filters &= Q(bim_model_id__in=valid_bim_models) & Q(root_dbid__in=region_dbids)

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
                    value_filters |= (
                        Q(display_name=display_name) &
                        Q(value=value)
                    )

            # 處理 fuzzy_keyword
            fuzzy_filters = Q()
            if fuzzy_keyword:
                label = fuzzy_keyword.get('label')
                display_name = fuzzy_keyword.get('display_name')

                if not isinstance(label, str):
                    raise ValidationError({
                        "fuzzy_keyword.label": f"必須是字串，收到：{label}",
                        "code": "invalid_fuzzy_label"
                    })
                label = label.strip()
                if not label:
                    raise ValidationError({
                        "fuzzy_keyword.label": "label 不能為空字串。",
                        "code": "empty_fuzzy_label"
                    })

                if display_name is not None and (not isinstance(display_name, str) or not display_name.strip()):
                    raise ValidationError({
                        "fuzzy_keyword.display_name": f"必須是空值或非空字串，收到：{display_name}",
                        "code": "invalid_fuzzy_display_name"
                    })

                fuzzy_filters = Q(value__contains=label)
                # 關閉三元組相似度查詢
                # fuzzy_filters = (
                #     Q(value__trigram_similar=label) |
                #     Q(value__contains=label)
                # )
                if display_name is not None:
                    fuzzy_filters &= Q(display_name=display_name)
                # else:
                #     fuzzy_filters &= Q(display_name="Name")  # 當 display_name 為 null 或未提供時，預設為 "Name"

            # 結合 filters
            if value_filters and fuzzy_filters:
                filters &= (value_filters | fuzzy_filters)
            elif value_filters:
                filters &= value_filters
            elif fuzzy_filters:
                filters &= fuzzy_filters

        print('-->', filters)
        # 查詢 BimObject
        queryset = models.BimObject.objects.filter(filters).select_related('bim_model').values(
            'id',
            'dbid',
            'value',
            'display_name',
            'root_dbid',  # 返回 root_dbid 以便調試或前端使用
            'bim_model__name',
            'bim_model__version',
            'bim_model__urn',
            'bim_model__svf_path',
            'bim_model__sqlite_path'
        ).order_by('bim_model', 'dbid')

        # 快存結果
        results = list(queryset)
        # cache.set(query_key, results, timeout=300)

        paginator = self.pagination_class()
        page_queryset = paginator.paginate_queryset(results, request)
        serializer = self.get_serializer(page_queryset, many=True)
        response = paginator.get_paginated_response(serializer.data)

        ip_address = request.META.get('REMOTE_ADDR')
        log_regions = f"regions: {regions[:3]}" if regions else ""
        log_cats = f"categories: {categories[:3]}" if categories else ""
        log_fuzzy = f"fuzzy_keyword: {fuzzy_keyword}" if fuzzy_keyword else ""
        log_message = f"查詢 {log_regions}{' ;' if log_regions else ''}{log_cats}{' ;' if log_cats else ''}{log_fuzzy}"
        log_user_activity(self.request.user, '圖資檢索', log_message, 'SUCCESS', ip_address)
        return response

    # 取得進階查詢分頁結果
    # @action(detail=False, methods=['post'])
    # def advanced(self, request, *args, **kwargs):
    #     conditions = request.data.get('conditions', None)
    #     if not conditions:
    #         raise ValidationError({
    #             "detail": "請提供 'conditions' 參數。",
    #             "code": "missing_conditions"
    #         })
    #     if not isinstance(conditions, list):
    #         raise ValidationError({
    #             "conditions": "必須是列表。",
    #             "code": "invalid_conditions_format"
    #         })
    #     if not conditions:
    #         raise ValidationError({
    #             "conditions": "不能為空列表。",
    #             "code": "empty_conditions"
    #         })

    #     valid_operators = {'gt', 'lt', 'gte', 'lte', 'eq', 'contains', 'range', 'like'}
    #     dbid_filters = None  # 用於儲存所有條件組的 dbid 交集

    #     for idx, condition in enumerate(conditions):
    #         if not isinstance(condition, dict):
    #             raise ValidationError({
    #                 "conditions": f"第 {idx} 個條件必須是物件，收到：{condition}",
    #                 "code": "invalid_condition_item"
    #             })

    #         display_name = condition.get('display_name')
    #         operator = condition.get('operator')
    #         value = condition.get('value')
    #         type_hint = condition.get('type', 'string')

    #         if not isinstance(display_name, str) or not display_name.strip():
    #             raise ValidationError({
    #                 f"conditions[{idx}].display_name": f"必須是非空字串，收到：{display_name}",
    #                 "code": "invalid_display_name"
    #             })
    #         if not isinstance(operator, str) or operator not in valid_operators:
    #             raise ValidationError({
    #                 f"conditions[{idx}].operator": f"必須是 {valid_operators} 之一，收到：{operator}",
    #                 "code": "invalid_operator"
    #             })

    #         # 驗證數值類型
    #         numeric_value = None
    #         if type_hint == 'number' and operator in {'gt', 'lt', 'gte', 'lte', 'eq'}:
    #             if value is None or (isinstance(value, str) and not value.strip()):
    #                 raise ValidationError({
    #                     f"conditions[{idx}].value": f"必須是非空值，收到：{value}",
    #                     "code": "invalid_value"
    #                 })
    #             try:
    #                 numeric_value = float(value)
    #             except ValueError:
    #                 raise ValidationError({
    #                     f"conditions[{idx}].value": f"當 type 為 number 且 operator 為 {operator} 時，value 必須是數值，收到：{value}",
    #                     "code": "invalid_numeric_value"
    #                 })

    #         # 驗證 range 運算符
    #         if operator == 'range':
    #             if type_hint != 'number':
    #                 raise ValidationError({
    #                     f"conditions[{idx}].operator": f"range 僅適用於 type=number，收到：{type_hint}",
    #                     "code": "invalid_operator"
    #                 })
    #             min_value = condition.get('min_value')
    #             max_value = condition.get('max_value')
    #             if min_value is None or max_value is None or \
    #                     (isinstance(min_value, str) and not min_value.strip()) or \
    #                     (isinstance(max_value, str) and not max_value.strip()):
    #                 raise ValidationError({
    #                     f"conditions[{idx}]": f"min_value 和 max_value 必須是非空值，收到：{min_value}, {max_value}",
    #                     "code": "invalid_range_value"
    #                 })
    #             try:
    #                 min_value = float(min_value)
    #                 max_value = float(max_value)
    #                 if min_value > max_value:
    #                     raise ValidationError({
    #                         f"conditions[{idx}]": f"min_value ({min_value}) 必須小於或等於 max_value ({max_value})",
    #                         "code": "invalid_range"
    #                     })
    #             except ValueError:
    #                 raise ValidationError({
    #                     f"conditions[{idx}]": f"min_value 和 max_value 必須是有效數值，收到：{min_value}, {max_value}",
    #                     "code": "invalid_numeric_value"
    #                 })

    #         # 構建條件過濾器
    #         condition_filter = Q()
    #         if operator == 'eq':
    #             condition_filter = Q(display_name=display_name)
    #             if type_hint == 'number':
    #                 condition_filter &= Q(numeric_value=numeric_value)
    #             else:
    #                 condition_filter &= Q(value=value)
    #         elif operator == 'contains':
    #             condition_filter = Q(display_name=display_name) & (
    #                 Q(value__contains=value) |
    #                 Q(value__trigram_similar=value)
    #             )
    #         elif operator == 'like':
    #             condition_filter = Q(display_name__iexact=display_name)  # 使用 iexact 進行不區分大小寫的精確匹配
    #         elif operator == 'range':
    #             condition_filter = Q(display_name=display_name) & Q(numeric_value__range=(min_value, max_value))
    #         elif type_hint == 'number' and operator in {'gt', 'lt', 'gte', 'lte'}:
    #             condition_filter = Q(display_name=display_name) & Q(**{f'numeric_value__{operator}': numeric_value})
    #         else:
    #             condition_filter = Q(display_name=display_name) & Q(**{f'value__{operator}': value})

    #         # 獲取符合當前條件組的 dbid 集合
    #         dbids = models.BimObject.objects.filter(condition_filter).values_list('dbid', flat=True).distinct()
    #         if not dbids.exists():
    #            # 創建空的查詢集
    #             empty_queryset = models.BimObject.objects.none()
    #             paginator = self.pagination_class()
    #             paginated_empty_queryset = paginator.paginate_queryset(empty_queryset, request)
    #             return paginator.get_paginated_response(empty_queryset)

    #         # 更新 dbid 交集
    #         if dbid_filters is None:
    #             dbid_filters = set(dbids)
    #         else:
    #             dbid_filters &= set(dbids)  # 取交集

    #     if not dbid_filters:
    #         # 如果交集為空，返回空結果
    #         return self.pagination_class().get_paginated_response([])

    #     # 基於最終的 dbid 集合查詢完整記錄
    #     query_data = {k: v for k, v in request.data.items() if k not in ['page', 'size']}
    #     query_key = hashlib.md5(str(query_data).encode()).hexdigest()
    #     cached_results = cache.get(query_key)
    #     if cached_results:
    #         paginator = self.pagination_class()
    #         page_queryset = paginator.paginate_queryset(cached_results, request)
    #         serializer = self.get_serializer(page_queryset, many=True)
    #         return paginator.get_paginated_response(serializer.data)

    #     # 查詢最終結果
    #     queryset = models.BimObject.objects.filter(
    #         dbid__in=dbid_filters,
    #         display_name='Name'  # 直接過濾 display_name='Name'
    #     ).select_related('bim_model').values(
    #         'id',
    #         'dbid',
    #         'value',
    #         'display_name',
    #         'root_dbid',
    #         'numeric_value',
    #         'parent_id',  # 新增 parent_id
    #         'bim_model__name',
    #         'bim_model__version',
    #         'bim_model__urn',
    #         'bim_model__svf_path',
    #         'bim_model__sqlite_path'
    #     ).order_by('bim_model', 'dbid')

    #     results = list(queryset)
    #     cache.set(query_key, results, timeout=300)

    #     paginator = self.pagination_class()
    #     page_queryset = paginator.paginate_queryset(results, request)
    #     serializer = self.get_serializer(page_queryset, many=True)
    #     response = paginator.get_paginated_response(serializer.data)

    #     ip_address = request.META.get('REMOTE_ADDR')
    #     log_conditions = f"conditions: {conditions[:3]}" if conditions else ""
    #     log_message = f"進階查詢 {log_conditions}"
    #     log_user_activity(self.request.user, '圖資進階檢索', log_message, 'SUCCESS', ip_address)
    #     return response

    # 下載BIM原始檔
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
        if not re.match(r'^([^-\n]+-){7}[^-\n]+$', file_name):
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
        base_path = 'uploads'
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

    # 取得進階查詢分頁結果
    @action(detail=False, methods=['post'])
    def advanced(self, request, *args, **kwargs):
        conditions = request.data.get('conditions', None)
        if not conditions:
            raise ValidationError({
                "detail": "請提供 'conditions' 參數。",
                "code": "missing_conditions"
            })
        if not isinstance(conditions, list):
            raise ValidationError({
                "conditions": "必須是列表。",
                "code": "invalid_conditions_format"
            })
        if not conditions:
            raise ValidationError({
                "conditions": "不能為空列表。",
                "code": "empty_conditions"
            })

        valid_operators = {'gt', 'lt', 'gte', 'lte', 'eq', 'contains', 'range', 'like'}
        dbid_model_filters = None  # 用於儲存所有條件組的 (dbid, bim_model_id) 交集

        for idx, condition in enumerate(conditions):
            if not isinstance(condition, dict):
                raise ValidationError({
                    "conditions": f"第 {idx} 個條件必須是物件，收到：{condition}",
                    "code": "invalid_condition_item"
                })

            display_name = condition.get('display_name')
            operator = condition.get('operator')
            value = condition.get('value')
            type_hint = condition.get('type', 'string')

            if not isinstance(display_name, str) or not display_name.strip():
                raise ValidationError({
                    f"conditions[{idx}].display_name": f"必須是非空字串，收到：{display_name}",
                    "code": "invalid_display_name"
                })
            if not isinstance(operator, str) or operator not in valid_operators:
                raise ValidationError({
                    f"conditions[{idx}].operator": f"必須是 {valid_operators} 之一，收到：{operator}",
                    "code": "invalid_operator"
                })

            # 驗證數值類型
            numeric_value = None
            if type_hint == 'number' and operator in {'gt', 'lt', 'gte', 'lte', 'eq'}:
                if value is None or (isinstance(value, str) and not value.strip()):
                    raise ValidationError({
                        f"conditions[{idx}].value": f"必須是非空值，收到：{value}",
                        "code": "invalid_value"
                    })
                try:
                    numeric_value = float(value)
                except ValueError:
                    raise ValidationError({
                        f"conditions[{idx}].value": f"當 type 為 number 且 operator 為 {operator} 時，value 必須是數值，收到：{value}",
                        "code": "invalid_numeric_value"
                    })

            # 驗證 range 運算符
            if operator == 'range':
                if type_hint != 'number':
                    raise ValidationError({
                        f"conditions[{idx}].operator": f"range 僅適用於 type=number，收到：{type_hint}",
                        "code": "invalid_operator"
                    })
                min_value = condition.get('min_value')
                max_value = condition.get('max_value')
                if min_value is None or max_value is None or \
                        (isinstance(min_value, str) and not min_value.strip()) or \
                        (isinstance(max_value, str) and not max_value.strip()):
                    raise ValidationError({
                        f"conditions[{idx}]": f"min_value 和 max_value 必須是非空值，收到：{min_value}, {max_value}",
                        "code": "invalid_range_value"
                    })
                try:
                    min_value = float(min_value)
                    max_value = float(max_value)
                    if min_value > max_value:
                        raise ValidationError({
                            f"conditions[{idx}]": f"min_value ({min_value}) 必須小於或等於 max_value ({max_value})",
                            "code": "invalid_range"
                        })
                except ValueError:
                    raise ValidationError({
                        f"conditions[{idx}]": f"min_value 和 max_value 必須是有效數值，收到：{min_value}, {max_value}",
                        "code": "invalid_numeric_value"
                    })

            # 構建條件過濾器
            condition_filter = Q()
            if operator == 'eq':
                condition_filter = Q(display_name=display_name)
                if type_hint == 'number':
                    condition_filter &= Q(numeric_value=numeric_value)
                else:
                    if value and isinstance(value, str) and ';' in value:
                        # 使用分號拆分多組關鍵字
                        keywords = [keyword.strip() for keyword in value.split(';') if keyword.strip()]
                        if keywords:
                            q_objects = Q()
                            for keyword in keywords:
                                q_objects |= Q(value__exact=keyword)
                            condition_filter &= q_objects
                        else:
                            condition_filter &= Q(value__isnull=True)
                    else:
                        condition_filter &= Q(value=value)
            elif operator == 'contains':
                condition_filter = Q(display_name=display_name)
                if type_hint == 'string' and value:
                    keywords = [keyword.strip() for keyword in value.split(';') if keyword.strip()]
                    if keywords:
                        q_objects = Q()
                        for keyword in keywords:
                            q_objects |= Q(value__contains=keyword)
                        condition_filter &= q_objects
                    else:
                        condition_filter &= Q(value__isnull=True)
                else:
                    condition_filter &= Q(value__contains=value)
            # 關閉三元組相似度查詢
            # elif operator == 'contains':
            #     condition_filter = Q(display_name=display_name)
            #     if type_hint == 'string' and value:
            #         keywords = [keyword.strip() for keyword in value.split(';') if keyword.strip()]
            #         if keywords:
            #             q_objects = Q()
            #             for keyword in keywords:
            #                 q_objects |= (Q(value__contains=keyword) | Q(value__trigram_similar=keyword))
            #             condition_filter &= q_objects
            #         else:
            #             condition_filter &= Q(value__isnull=True)
            #     else:
            #         condition_filter &= (Q(value__contains=value) | Q(value__trigram_similar=value))
            elif operator == 'like':
                condition_filter = Q(display_name__iexact=display_name)
            elif operator == 'range':
                condition_filter = Q(display_name=display_name) & Q(numeric_value__range=(min_value, max_value))
            elif type_hint == 'number' and operator in {'gt', 'lt', 'gte', 'lte'}:
                condition_filter = Q(display_name=display_name) & Q(**{f'numeric_value__{operator}': numeric_value})
            else:
                condition_filter = Q(display_name=display_name) & Q(**{f'value__{operator}': value})

            # 獲取符合當前條件組的 (dbid, bim_model_id) 集合
            dbids = models.BimObject.objects.filter(condition_filter).values_list('dbid', 'bim_model_id').distinct()
            if not dbids.exists():
                # 創建空的查詢集並返回分頁響應
                empty_queryset = models.BimObject.objects.none()
                paginator = self.pagination_class()
                paginated_empty_queryset = paginator.paginate_queryset(empty_queryset, request)
                return paginator.get_paginated_response(paginated_empty_queryset)

            # 更新 (dbid, bim_model_id) 交集
            if dbid_model_filters is None:
                dbid_model_filters = set(dbids)
            else:
                dbid_model_filters &= set(dbids)  # 取交集

        if not dbid_model_filters:
            # 如果交集為空，返回空分頁響應
            empty_queryset = models.BimObject.objects.none()
            paginator = self.pagination_class()
            paginated_empty_queryset = paginator.paginate_queryset(empty_queryset, request)
            return paginator.get_paginated_response(paginated_empty_queryset)

        # 基於最終的 (dbid, bim_model_id) 集合查詢完整記錄
        query_data = {k: v for k, v in request.data.items() if k not in ['page', 'size']}
        query_key = hashlib.md5(str(query_data).encode()).hexdigest()
        cached_results = cache.get(query_key)
        if cached_results:
            paginator = self.pagination_class()
            page_queryset = paginator.paginate_queryset(cached_results, request)
            serializer = self.get_serializer(page_queryset, many=True)
            return paginator.get_paginated_response(serializer.data)

        # 查詢最終結果
        q_objects = Q()
        for dbid, bim_model_id in dbid_model_filters:
            q_objects |= Q(dbid=dbid, bim_model_id=bim_model_id)

        queryset = models.BimObject.objects.filter(
            q_objects,
            display_name='Name'
        ).select_related('bim_model').values(
            'id',
            'dbid',
            'value',
            'display_name',
            'root_dbid',
            'numeric_value',
            'parent_id',
            'bim_model__name',
            'bim_model__version',
            'bim_model__urn',
            'bim_model__svf_path',
            'bim_model__sqlite_path'
        ).order_by('bim_model', 'dbid')

        results = list(queryset)
        cache.set(query_key, results, timeout=300)

        paginator = self.pagination_class()
        page_queryset = paginator.paginate_queryset(results, request)
        serializer = self.get_serializer(page_queryset, many=True)
        response = paginator.get_paginated_response(serializer.data)

        ip_address = request.META.get('REMOTE_ADDR')
        log_conditions = f"conditions: {conditions[:3]}" if conditions else ""
        log_message = f"進階查詢 {log_conditions}"
        log_user_activity(self.request.user, '圖資進階檢索', log_message, 'SUCCESS', ip_address)
        return response

    @action(detail=False, methods=['post'])
    def download_txt(self, request):
        """下載查詢結果為 TXT 檔案，使用 pandas 和 FileResponse"""
        try:
            # 從 request.data 獲取參數
            regions = request.data.get('regions', request.data.get('zones', None))
            fuzzy_keyword = request.data.get('fuzzy_keyword', None)

            if not isinstance(regions, list):
                raise ValidationError({
                    "regions": "必須是列表。",
                    "code": "invalid_regions_format"
                })

            # 獲取查詢結果
            results = self.download_data(request)

            # 檢查是否有資料
            buffer = io.BytesIO()
            if not results:
                # 返回空的 TXT 檔案（與 CSV 格式相同）
                buffer.write('id,dbid,value,display_name,root_dbid,bim_model__name\n'.encode('utf-8-sig'))
                buffer.seek(0)
                response = FileResponse(
                    buffer,
                    as_attachment=True,
                    filename='bim_objects.txt',  # 固定檔名
                    content_type='text/plain'
                )
            else:
                # 分塊生成 TXT（格式與 CSV 相同）
                chunk_size = 10000
                chunk_data = []
                first_chunk = True

                for record in results:
                    chunk_data.append(record)
                    if len(chunk_data) >= chunk_size:
                        # 處理一批資料
                        df = pd.DataFrame.from_records(chunk_data)
                        df.columns = ['id', 'dbid', 'value', 'display_name', 'root_dbid', 'bim_model__name']
                        if first_chunk:
                            df.to_csv(buffer, index=False, encoding='utf-8-sig')
                            first_chunk = False
                        else:
                            df.to_csv(buffer, index=False, encoding='utf-8-sig', header=False)
                        chunk_data = []  # 清空 chunk

                # 處理剩餘的資料
                if chunk_data:
                    df = pd.DataFrame.from_records(chunk_data)
                    df.columns = ['id', 'dbid', 'value', 'display_name', 'root_dbid', 'bim_model__name']
                    if first_chunk:
                        df.to_csv(buffer, index=False, encoding='utf-8-sig')
                    else:
                        df.to_csv(buffer, index=False, encoding='utf-8-sig', header=False)

                buffer.seek(0)
                response = FileResponse(
                    buffer,
                    as_attachment=True,
                    filename='bim_objects.txt',  # 固定檔名
                    content_type='text/plain'
                )

            # 記錄日誌
            ip_address = request.META.get('REMOTE_ADDR')
            regions_log = f"regions: {str(regions)[:100]}" if regions else ""
            categories = f"categories: {str(request.data.get('categories', ''))[:100]}" if request.data.get('categories') else ""
            fuzzy_keyword_log = f"fuzzy_keyword: {str(fuzzy_keyword)[:100]}" if fuzzy_keyword else ""
            log_message = f"下載 TXT {regions_log}{' ;' if regions_log else ''}{categories}{' ;' if categories else ''}{fuzzy_keyword_log}"
            log_user_activity(self.request.user, '圖資下載', log_message, 'SUCCESS', ip_address)

            return response
        except ValidationError as e:
            raise  # DRF 會序列化為 JSON
        except Exception as e:
            return Response(
                {"detail": f"下載失敗：{str(e)}", "code": "unexpected_error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def download_data(self, request):
        """查詢所有資料，供下載 CSV 或 TXT 使用，重用 create 方法的查詢邏輯"""
        regions = request.data.get('regions', request.data.get('zones', None))
        categories = request.data.get('categories', None)
        fuzzy_keyword = request.data.get('fuzzy_keyword', None)

        if not regions:
            raise ValidationError({
                "detail": "請提供 'regions' 參數。",
                "code": "missing_regions"
            })

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

        if fuzzy_keyword:
            if not isinstance(fuzzy_keyword, dict):
                raise ValidationError({
                    "fuzzy_keyword": "必須是物件，包含 label 和 display_name。",
                    "code": "invalid_fuzzy_keyword_format"
                })
            label = fuzzy_keyword.get('label')
            if label is None or (isinstance(label, str) and not label.strip()):
                fuzzy_keyword = None

        query_data = {k: v for k, v in request.data.items() if k not in ['page', 'size']}
        query_key = hashlib.md5(str(query_data).encode()).hexdigest()

        valid_bim_models = set()
        region_dbids = set()
        region_values = set()

        for region in regions:
            zone_id = region.get('zone_id')
            role_id = region.get('role_id')
            level = region.get('level')

            if zone_id is not None and not isinstance(zone_id, int):
                raise ValidationError({
                    "zone_id": f"必須是整數或 null，收到：{zone_id}",
                    "code": "invalid_zone_id"
                })
            if role_id is not None and not isinstance(role_id, int):
                raise ValidationError({
                    "role_id": f"必須是整數或 null，收到：{role_id}",
                    "code": "invalid_role_id"
                })
            if level is not None and not isinstance(level, str):
                raise ValidationError({
                    "level": f"必須是字串或 null，收到：{level}",
                    "code": "invalid_level"
                })

            bim_region_qs = models.BimRegion.objects.all()
            if zone_id is not None:
                bim_region_qs = bim_region_qs.filter(zone_id=zone_id)
            if role_id is not None:
                bim_region_qs = bim_region_qs.filter(role_id=role_id)
            if level is not None:
                bim_region_qs = bim_region_qs.filter(level=level)

            bim_regions = bim_region_qs.values('bim_model_id', 'dbid', 'value')

            if not bim_regions.exists():
                raise ValidationError({
                    "regions": f"無效的組合：zone_id={zone_id}, role_id={role_id}, level={level}",
                    "code": "invalid_region_combination"
                })

            for bim_region in bim_regions:
                bim_model_id = bim_region['bim_model_id']
                dbid = bim_region['dbid']
                value = bim_region['value'].strip()
                if not models.BimModel.objects.filter(id=bim_model_id).exists():
                    raise ValidationError({
                        "bim_model_id": f"無效的 bim_model_id：{bim_model_id}",
                        "code": "invalid_bim_model_id"
                    })
                valid_bim_models.add(bim_model_id)
                region_dbids.add(dbid)
                region_values.add(value)

        filters = Q()
        if not categories and not fuzzy_keyword:
            if region_dbids and valid_bim_models and region_values:
                filters &= Q(dbid__in=region_dbids) & Q(bim_model_id__in=valid_bim_models) & Q(
                    display_name="Name") & Q(value__in=region_values)
            else:
                filters &= Q(dbid__in=[])
        else:
            if valid_bim_models:
                filters &= Q(bim_model_id__in=valid_bim_models) & Q(root_dbid__in=region_dbids)

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
                    value_filters |= (
                        Q(display_name=display_name) &
                        Q(value=value)
                    )

            fuzzy_filters = Q()
            if fuzzy_keyword:
                label = fuzzy_keyword.get('label')
                display_name = fuzzy_keyword.get('display_name')

                if not isinstance(label, str):
                    raise ValidationError({
                        "fuzzy_keyword.label": f"必須是字串，收到：{label}",
                        "code": "invalid_fuzzy_label"
                    })
                label = label.strip()
                if not label:
                    raise ValidationError({
                        "fuzzy_keyword.label": "label 不能為空字串。",
                        "code": "empty_fuzzy_label"
                    })

                if display_name is not None and (not isinstance(display_name, str) or not display_name.strip()):
                    raise ValidationError({
                        "fuzzy_keyword.display_name": f"必須是空值或非空字串，收到：{display_name}",
                        "code": "invalid_fuzzy_display_name"
                    })

                fuzzy_filters = Q(value__contains=label)
                # 關閉三元組相似度查詢
                # fuzzy_filters = (
                #     Q(value__trigram_similar=label) |
                #     Q(value__contains=label)
                # )
                if display_name is not None:
                    fuzzy_filters &= Q(display_name=display_name)
                # else:
                #     fuzzy_filters &= Q(display_name="Name")  # 當 display_name 為 null 或未提供時，預設為 "Name"

            if value_filters and fuzzy_filters:
                filters &= (value_filters | fuzzy_filters)
            elif value_filters:
                filters &= value_filters
            elif fuzzy_filters:
                filters &= fuzzy_filters

        queryset = models.BimObject.objects.filter(filters).select_related('bim_model').values(
            'id',
            'dbid',
            'value',
            'display_name',
            'root_dbid',
            'bim_model__name',
            'bim_model__version',
            'bim_model__urn',
            'bim_model__svf_path',
            'bim_model__sqlite_path'
        ).order_by('bim_model', 'dbid')

        # 返回欄位
        queryset = queryset.values(
            'id', 'dbid', 'value', 'display_name', 'root_dbid', 'bim_model__name'
        )

        results = list(queryset)
        return results


class BimCobieObjectViewSet(AutoPrefetchViewSetMixin, viewsets.ReadOnlyModelViewSet):
    permission_classes = (IsAuthenticated,)
    queryset = models.BimObject.objects.all()

    @action(detail=False, methods=['get'])
    def distinct_name_value(self, request):
        try:
            # 先取得唯一 display_name 和 value，且 display_name 以 "COBie." 開頭
            distinct_pairs = models.BimObject.objects.filter(
                display_name__startswith='COBie.'
            ).values('display_name', 'value').distinct().order_by('display_name')

            # 查詢所有有效的 BimCobie 並轉成 dict 方便在 Python 中映射描述
            cobie_description_map = dict(
                models.BimCobie.objects.filter(is_active=True).values_list('name', 'description')
            )

            data = []
            for item in distinct_pairs:
                description = cobie_description_map.get(item['display_name'], '') or item['display_name']
                data.append({
                    'display_name': item['display_name'],
                    'label': item['value'],
                    'description': description,
                })

            return Response(data, status=200)

        except Exception as e:
            logger.error(f"Error fetching distinct name-value pairs: {str(e)}", exc_info=True)
            return Response(
                {"error": "伺服器內部錯誤，請聯繫管理員"},
                status=500
            )

    # @action(detail=False, methods=['get'])
    # def distinct_name_value(self, request):
    #     try:
    #         # 查詢以 'COBie.' 開頭的唯一 display_name 和 value，並按 display_name 排序
    #         queryset = models.BimObject.objects.filter(
    #             display_name__startswith='COBie.'
    #         ).values('display_name', 'value').distinct().order_by('display_name')

    #         # 與 BimCobie 表進行 LEFT JOIN
    #         queryset = queryset.annotate(
    #             description=Coalesce(
    #                 Subquery(
    #                     models.BimCobie.objects.filter(name=OuterRef('display_name')).values('description')[:1]
    #                 ),
    #                 Value(''),  # 如果無映射，預設為空字串
    #                 output_field=CharField()
    #             )
    #         )

    #         # 將查詢結果轉為列表並添加 description 欄位
    #         data = [
    #             {
    #                 'display_name': item['display_name'],
    #                 'label': item['value'],
    #                 'description': item['description'] or item['display_name'],
    #                 # 'description': f"{item['value']} ({item['display_name']})"
    #             }
    #             for item in queryset
    #         ]

    #         return Response(data, status=200)

    #     except Exception as e:
    #         # 記錄錯誤日誌
    #         logger.error(f"Error fetching distinct name-value pairs: {str(e)}", exc_info=True)
    #         return Response(
    #             {"error": "伺服器內部錯誤，請聯繫管理員"},
    #             status=500
    #         )

    @action(detail=False, methods=['get'])
    def distinct_name(self, request):
        try:
            # 查詢以 'COBie.' 開頭的唯一 display_name，並按字母排序
            display_names = models.BimObject.objects.filter(
                display_name__startswith='COBie.'
            ).values('display_name').distinct().order_by('display_name')

            # 提取 display_name 列表
            result = [item['display_name'] for item in display_names]

            return Response({
                'count': len(result),
                'results': result
            }, status=200)

        except Exception as e:
            # 記錄錯誤日誌
            logger.error(f"Error fetching distinct display names: {str(e)}", exc_info=True)
            return Response(
                {"error": "伺服器內部錯誤，請聯繫管理員"},
                status=500
            )

    @action(detail=False, methods=['get'])
    def download_csv(self, request):
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


class BimObjectDbidView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request, *args, **kwargs):
        # 從 GET 請求參數獲取 file_name 和 value
        model_name = request.query_params.get('model_name')
        value = request.query_params.get('value')

        # 檢查參數是否完整
        if not model_name or not value:
            return Response(
                {"detail": "Missing 'model_name' or 'value' query parameter."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 查詢符合條件的 dbid
        queryset = models.BimObject.objects.filter(
            bim_model__name=model_name,
            value=value,
            display_name='Name'
        )

        # 提取不重複的 dbid 陣列
        dbids = list(queryset.values_list('dbid', flat=True).distinct())
        return Response({'dbids': dbids})


class BimOriginalFileDownloadView(APIView):
    permission_classes = (IsAuthenticated,)
    """
    下載 media-root/uploads 目錄下的 BIM 檔案
    前端需傳入 file_name 參數，例如 T3-TP01-XXX-XX-XXX-M3-XX-00001.nwd
    - 若提供 version 參數，則下載版本檔案：media-root/uploads/{file_name_without_extension}/ver_{version}/{file_name}
    - 若未提供 version 參數，則下載最新版本檔案：media-root/uploads/{file_name_without_extension}/ver_{version}/{file_name}
    """

    def get(self, request, *args, **kwargs):
        # 從查詢參數獲取 file_name 和 version
        file_name = request.query_params.get('file_name')
        version = request.query_params.get('version')

        # 驗證 file_name
        if not file_name:
            return Response(
                {"error": "請提供 file_name 參數"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 檢查檔案名稱格式
        if not re.match(r'^([^-\n]+-){7}[^-\n]+$', file_name):
            return Response(
                {"error": f"無效的檔案名稱格式：'{file_name}'。預期格式：XX-XXXX-XXX-XX-XXX-XX-XX-XXXXX.副檔名"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 構建檔案路徑
        base_path = 'uploads'  # 保持小寫，與 BimDataImportView 一致
        if version:
            # 驗證版本號是否為正整數
            try:
                version = int(version)
                if version <= 0:
                    raise ValueError
            except ValueError:
                return Response(
                    {"error": "版本號必須為正整數"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            # 未提供 version，查詢最新版本
            try:
                bim_model = models.BimModel.objects.get(name=file_name)
                version = bim_model.version
            except models.BimModel.DoesNotExist:
                return Response(
                    {"error": f"BimModel with name '{file_name}' not found"},
                    status=status.HTTP_404_NOT_FOUND
                )

        # 檔案路徑：uploads/{file_name}/ver_{version}/{file_name}
        storage_file_path = os.path.join(base_path, file_name, f"ver_{version}", file_name).replace(os.sep, '/')
        file_path = os.path.join(settings.MEDIA_ROOT, storage_file_path).replace(os.sep, '/')

        # 統一路徑分隔符為當前系統的分隔符
        file_path = os.path.normpath(file_path)
        media_root = os.path.normpath(str(settings.MEDIA_ROOT))

        # 防止路徑遍歷攻擊
        if '..' in os.path.normpath(file_name) or not file_path.startswith(media_root):
            return Response(
                {"error": "無效的檔案路徑"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 檢查檔案是否存在
        if not default_storage.exists(storage_file_path):
            error_msg = f"版本 {version} 的檔案 '{file_name}' 不存在"
            return Response(
                {"error": error_msg},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            # 開啟檔案並回傳 FileResponse
            file = default_storage.open(storage_file_path, 'rb')
            response = FileResponse(file, as_attachment=True, filename=smart_str(file_name))
            return response
        except Exception as e:
            return Response(
                {"error": f"下載檔案時發生錯誤：{str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class BimSqliteDownloadView(APIView):
    permission_classes = (IsAuthenticated,)
    """
    下載 media-root/sqlite 目錄下的 SQLite 檔案
    前端需傳入 file_name 參數，例如 T3-TP01-XXX-XX-XXX-M3-XX-00001.nwd
    - 若提供 version 參數，則下載版本檔案：media-root/sqlite/{file_name_without_extension}/ver_{version}/{file_name}.db
    - 若未提供 version 參數，則下載最新版本檔案：media-root/sqlite/{file_name_without_extension}/ver_{version}/{file_name}.db
    """

    def get(self, request, *args, **kwargs):
        # 從查詢參數獲取 file_name 和 version
        file_name = request.query_params.get('file_name')
        version = request.query_params.get('version')

        # 驗證 file_name
        if not file_name:
            return Response(
                {"error": "請提供 file_name 參數"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 檢查檔案名稱格式
        if not re.match(r'^([^-\n]+-){7}[^-\n]+$', file_name):
            return Response(
                {"error": f"無效的檔案名稱格式：'{file_name}'。預期格式：XX-XXXX-XXX-XX-XXX-XX-XX-XXXXX.副檔名"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 構建檔案路徑
        base_path = 'sqlite'  # 保持小寫，與 BimOriginalFileDownloadView 一致
        if version:
            # 驗證版本號是否為正整數
            try:
                version = int(version)
                if version <= 0:
                    raise ValueError
            except ValueError:
                return Response(
                    {"error": "版本號必須為正整數"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            # 未提供 version，查詢最新版本
            try:
                bim_model = models.BimModel.objects.get(name=file_name)
                version = bim_model.version
            except models.BimModel.DoesNotExist:
                return Response(
                    {"error": f"BimModel with name '{file_name}' not found"},
                    status=status.HTTP_404_NOT_FOUND
                )

        # 檔案路徑：uploads/{file_name_without_extension}/ver_{version}/{file_name}.db
        storage_file_path = os.path.join(base_path, file_name, f"ver_{version}", f"{file_name}.db").replace(os.sep, '/')
        file_path = os.path.join(settings.MEDIA_ROOT, storage_file_path).replace(os.sep, '/')

        # 統一路徑分隔符為當前系統的分隔符
        file_path = os.path.normpath(file_path)
        media_root = os.path.normpath(str(settings.MEDIA_ROOT))

        # 防止路徑遍歷攻擊
        if '..' in os.path.normpath(file_name) or not file_path.startswith(media_root):
            return Response(
                {"error": "無效的檔案路徑"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 檢查檔案是否存在
        if not default_storage.exists(storage_file_path):
            error_msg = f"版本 {version} 的 SQLite 檔案 '{file_name}.db' 不存在"
            return Response(
                {"error": error_msg},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            # 開啟檔案並回傳 FileResponse
            file = default_storage.open(storage_file_path, 'rb')
            response = FileResponse(file, as_attachment=True, filename=smart_str(file_name))
            return response
        except Exception as e:
            return Response(
                {"error": f"下載 SQLite 檔案時發生錯誤：{str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class BimCobieViewSet(AutoPrefetchViewSetMixin, viewsets.ReadOnlyModelViewSet):
    permission_classes = (IsAuthenticated,)
    queryset = models.BimCobie.objects.filter(is_active=True).order_by('name')
    serializer_class = serializers.BimCobieSerializer

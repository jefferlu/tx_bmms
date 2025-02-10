import os
import json
import sqlite3
import pandas as pd
from pathlib import Path

from django.core.files.storage import default_storage
from django.core.files.base import ContentFile

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, FileUploadParser
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from drf_spectacular.utils import extend_schema

from apps.forge.api.tasks import bim_data_import
from utils.utils import check_redis, get_aps_credentials, get_aps_bucket
from ..aps_toolkit import Auth, Bucket, Derivative, PropReader
from . import serializers
from apps.core import models


# CLIENT_ID = '94MGPGEtqunCJS6XyZAAnztSSIrtfOLsVWQEkLNQ7uracrAC'
# CLIENT_SECRET = 'G5tBYHoxe9xbpsisxGo5kBZOCPwEFCCuXIYr8kms28SSRuuVAHR0G766A3RKFQXy'
# BUCKET_KEY = 'bmms_oss'


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
            #     print(obj)

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

# class CompareSqliteView(APIView):
#     def fetch_eav_data_from_db(self, db_file):
#         """從 SQLite 資料庫中抓取 _objects_eav 的資料"""
#         conn = sqlite3.connect(db_file)
#         query = """
#         SELECT
#             eav.entity_id,
#             eav.attribute_id,
#             eav.value_id
#         FROM
#             _objects_eav AS eav
#         """
#         df = pd.read_sql_query(query, conn)
#         conn.close()
#         return df

#     def compare_eav_tables(self, db_file_1, db_file_2):
#         """比對兩個資料庫中的 _objects_eav 資料表差異"""
#         # 從兩個資料庫抓取 _objects_eav 的資料
#         df1 = self.fetch_eav_data_from_db(db_file_1)
#         df2 = self.fetch_eav_data_from_db(db_file_2)

#         # 比對 _objects_eav 資料表，找出不同的行
#         merged_df = pd.merge(df1, df2, on=["entity_id", "attribute_id", "value_id"], how="outer", indicator=True)

#         # 只保留存在差異的資料
#         diff_eav_df = merged_df[merged_df['_merge'] != 'both']

#         return diff_eav_df

#     def join_with_other_tables(self, db_file, diff_eav_df):
#         """將差異資料與其他表進行 JOIN，獲取相關資訊"""
#         # 連接資料庫
#         conn = sqlite3.connect(db_file)

#         # 根據差異資料的 entity_id 和 value_id 進行 JOIN 操作，獲取 display_name 和 value
#         query = """
#         SELECT
#             eav.entity_id,
#             attr.category,
#             attr.display_name,
#             val.value
#         FROM
#             _objects_eav AS eav
#         JOIN
#             _objects_attr AS attr ON eav.attribute_id = attr.id
#         JOIN
#             _objects_val AS val ON eav.value_id = val.id
#         WHERE
#             eav.entity_id IN ({})
#         """.format(','.join([str(x) for x in diff_eav_df['entity_id'].unique()]))

#         # 執行查詢並返回結果
#         result_df = pd.read_sql_query(query, conn)
#         conn.close()

#         return result_df

#     def compare_sqlite_databases(self, db_file_1, db_file_2):
#         """比較兩個 SQLite 資料庫，並將差異結果進行 JOIN"""
#         # 先比對 _objects_eav 資料表的差異
#         diff_eav_df = self.compare_eav_tables(db_file_1, db_file_2)

#         if not diff_eav_df.empty:
#             # 若有差異，則進行其他表的 JOIN 操作
#             final_result_df_1 = self.join_with_other_tables(db_file_1, diff_eav_df)
#             final_result_df_2 = self.join_with_other_tables(db_file_2, diff_eav_df)

#             # 合併兩個結果，並標示出每個資料的來源 (model_1 或 model_2)
#             final_df = pd.merge(final_result_df_1, final_result_df_2, on=["entity_id", "category", "display_name"], suffixes=("_model_1", "_model_2"))

#             # 比較 value 欄位，找出差異
#             final_df["value_diff"] = final_df["value_model_1"] != final_df["value_model_2"]

#             # 只保留有差異的部分（value_diff為True）
#             diff_df = final_df[final_df["value_diff"] == True]

#             # 只顯示需要的欄位
#             diff_df = diff_df[["entity_id", "category", "display_name", "value_model_1", "value_model_2", "value_diff"]]

#             return diff_df
#         else:
#             return pd.DataFrame()

#     def get(self, request):
#         try:
#             path = os.path.join(Path(__file__).parent.parent.parent.parent, "media-root/database")

#             # 連接到兩個 SQLite 資料庫
#             model_1_db = f'{path}/TEST.rvt.db'
#             model_2_db = f'{path}/TEST(刪除管線).rvt.db'
#             print('start compare...')
#             # 比較兩個 SQLite 資料庫
#             # diff_df = self.compare_sqlite_databases(model_1_db, model_2_db)
#             diff_eav_df = self.compare_eav_tables(model_1_db, model_2_db)
#             diff_dict = diff_eav_df.to_dict(orient='records')

#             # 顯示比較結果
#             if not diff_eav_df.empty:
#                 print("模型之間的差異：")
#                 print(diff_eav_df)
#             else:
#                 print("兩個模型之間沒有差異。")

#             return Response({'result': diff_dict}, status=status.HTTP_200_OK)
#         except sqlite3.DatabaseError as e:
#             return Response({'error': f'SQLite database error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
#         except Exception as e:
#             return Response({'error': f'An unexpected error occurred: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# class CompareSqliteView(APIView):
#     def compare_models(self, model_1_db, model_2_db):
#         """比較兩個模型的屬性差異"""
#         try:
#             query = """
#                 SELECT
#                     t1.id,
#                     t1.external_id,
#                     t2.category,
#                     t2.display_name,
#                     t3.value
#                 FROM _objects_id AS t1
#                     JOIN _objects_eav AS eav1 ON t1.id = eav1.entity_id
#                     JOIN _objects_attr AS t2 ON eav1.attribute_id = t2.id
#                     JOIN _objects_val AS t3 ON eav1.value_id = t3.id
#             """
#             # query = """
#             # SELECT _objects_id.external_id,
#             #        _objects_attr.category,
#             #        _objects_attr.display_name,
#             #        _objects_val.value
#             # FROM _objects_id
#             # JOIN _objects_eav ON _objects_id.id = _objects_eav.entity_id
#             # JOIN _objects_attr ON _objects_eav.attribute_id = _objects_attr.id
#             # JOIN _objects_val ON _objects_eav.value_id = _objects_val.id
#             # """

#             # 連接到第一個資料庫並抓取數據
#             connection_1 = sqlite3.connect(model_1_db)
#             df1 = pd.read_sql_query(query, connection_1)
#             connection_1.close()

#             # 連接到第二個資料庫並抓取數據
#             connection_2 = sqlite3.connect(model_2_db)
#             df2 = pd.read_sql_query(query, connection_2)
#             connection_2.close()

#             # 將兩個 DataFrame 合併，並找出不一致的部分
#             merged_df = pd.merge(df1, df2, on=["id", "category", "display_name"],
#                                  how="outer", suffixes=("_model_1", "_model_2"))

#             # 比較 value 欄位，找出差異
#             merged_df["value_diff"] = merged_df["value_model_1"] != merged_df["value_model_2"]

#             # 只保留有差異的部分（value_diff為True）
#             diff_df = merged_df[merged_df["value_diff"] == True]

#             # 回傳差異結果
#             return diff_df

#         except Exception as e:
#             return f"發生錯誤: {e}"

#     def get(self, request):
#         try:
#             path = os.path.join(Path(__file__).parent.parent.parent.parent, "media-root/database")

#             # 連接到兩個 SQLite 資料庫
#             model_1_db = f'{path}/TEST.rvt.db'
#             model_2_db = f'{path}/TEST(刪除管線).rvt.db'

#             # 比較兩個模型
#             diff_df = self.compare_models(model_1_db, model_2_db)


#             if isinstance(diff_df, pd.DataFrame) and not diff_df.empty:
#                 print("模型之間的差異：")
#                 print(diff_df)
#             else:
#                 print("模型之間沒有差異")
#                 print(diff_df)

#             return Response({'result': diff_df},status=status.HTTP_200_OK)
#         except sqlite3.DatabaseError as e:
#             return Response({'error': f'SQLite database error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
#         except Exception as e:
#             return Response({'error': f'An unexpected error occurred: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
            return Response({"error": "No file provided"}, status=400)

        # check_redis('localhost')

        # Save file
        file_path = f'uploads/{file.name}'
        # if default_storage.exists(file_path):
        #     default_storage.delete(file_path)
        default_storage.save(file_path, ContentFile(file.read()))

        # 執行Autodesk Model Derivative API轉換
        bim_data_import.delay(client_id, client_secret, bucket_key, file.name, 'progress_group')        
        # bim_data_import(client_id, client_secret, bucket_key, file.name, 'progress_group')

        # # 回應上傳成功的訊息
        return Response({"message": f"File '{file.name}' is being processed."}, status=200)


@extend_schema(
    summary="BIM data reload",
    description="Endpoint to import BIM data",
    tags=['APS']
)
class BimDataReloadView(APIView):

    def post(self, request, *args, **kwargs):
        client_id, client_secret = get_aps_credentials(request.user)
        bucket_key = get_aps_bucket(client_id, client_secret)

        filename = request.data.get('filename')
        if not filename:
            return Response({"error": "No filename provided"}, status=400)

        # 執行Autodesk Model Derivative API轉換
        # bim_data_import.delay(client_id, client_secret, bucket_key, filename, 'progress_group', True)
        bim_data_import(client_id, client_secret, bucket_key, filename, 'progress_group', True)

        # # 回應上傳成功的訊息
        return Response({"message": f"File '{filename}' is being processed."}, status=200)

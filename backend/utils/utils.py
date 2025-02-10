import sys
import datetime
import json
import traceback
import redis
import base64

from django.conf import settings
from rest_framework.exceptions import NotFound

from apps.forge.aps_toolkit import Auth, Bucket
from apps.forge.aps_toolkit.Bucket import PublicKey

from apps.core import models


def show_exception(e, message=None):
    error_class = e.__class__.__name__  # 取得錯誤類型
    detail = e.args[0]  # 取得詳細內容
    cl, exc, tb = sys.exc_info()  # 取得Call Stack
    lastCallStack = traceback.extract_tb(tb)[-1]  # 取得Call Stack的最後一筆資料
    # fileName = lastCallStack[0]  # 取得發生的檔案名稱
    # lineNum = lastCallStack[1]  # 取得發生的行號
    # funcName = lastCallStack[2]  # 取得發生的函數名稱

    if settings.DEBUG:
        errMsg = {
            'return_code': -1,
            'message': detail,
            'type': error_class,
            'location': str(lastCallStack),
            'code': lastCallStack[3]
        }
    else:
        errMsg = {
            'return_code': -1,
            'message': detail
        }
    return errMsg


def check_redis(host='localhost', port=6379, db=0):
    try:
        client = redis.StrictRedis(host=host, port=port, db=db)
        pong = client.ping()
        if pong:
            print("Redis 連線成功！")
    except redis.ConnectionError as e:
        print(f"Redis 無法連線: {e}")


def get_aps_credentials(user):
    """透過 user 取得 APS Credentials"""
    try:
        company = user.user_profile.company
    except AttributeError:
        raise NotFound("User's profile or company not found.")

    credentials = models.AutodeskCredentials.objects.filter(company=company).first()
    if not credentials:
        raise NotFound("No APS credentials found for the company.")

    return credentials.client_id, credentials.client_secret


def get_aps_bucket(client_id, client_secret):
    auth = Auth(client_id, client_secret)
    token = auth.auth2leg()
    bucket = Bucket(token)
    data = json.loads(bucket.get_all_buckets().to_json(orient='records'))

    for item in data:
        if item.get("bucketKey", "").startswith("bmms_oss"):
            return item["bucketKey"]

    bocket_key = f'bmms_oss_{datetime.datetime.now().strftime("%y%m%d%H%M%S")}'
    ret = bucket.create_bucket(bocket_key, PublicKey.persistent)
    print('ret-->', ret)
    return bocket_key


def get_aps_urn(object_id: str) -> str:
    encoded_data = base64.urlsafe_b64encode(object_id.encode("utf-8")).rstrip(b'=')
    urn = encoded_data.decode("utf-8")
    return urn

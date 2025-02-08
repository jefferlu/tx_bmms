import sys
import redis
import traceback
import sqlite3

from django.conf import settings
from rest_framework.exceptions import NotFound

from apps.core import models

def ShowException(e, message=None):
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

def checkRedis(host='localhost', port=6379, db=0):
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
    
    return credentials.client_id, credentials.client_secret, credentials.bucket_key
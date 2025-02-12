import datetime
import json
import redis
import base64
import sqlite3

from rest_framework.exceptions import NotFound
from apps.forge.aps_toolkit import Auth, Bucket
from apps.forge.aps_toolkit.Bucket import PublicKey

from apps.core import models as core_models
from apps.forge import models as forge_models


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

    credentials = core_models.AutodeskCredentials.objects.filter(company=company).first()
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


def process_sqlite_data(svf_file_path, bim_model_id):
    """
    讀取 SQLite 資料並存入 BIMConversion
    """
    conn = sqlite3.connect(svf_file_path)
    cursor = conn.cursor()

    # 假設 SQLite 有一個 `bim_properties` 表，存放 BIM 物件的屬性
    cursor.execute("SELECT id, name, type, properties FROM bim_properties")
    records = cursor.fetchall()

    # 取得當前 Model
    bim_model = forge_models.BIMModel.objects.get(id=bim_model_id)

    # 建立轉換版本
    last_conversion = bim_model.conversions.order_by('-version').first()
    new_version = last_conversion.version + 1 if last_conversion else 1

    # 建立新的 BIMConversion 記錄
    conversion = forge_models.BIMConversion.objects.create(
        bim_model=bim_model,
        version=new_version,
        svf_file=svf_file_path,
        status="completed"
    )

    # 可以進一步存入其他資料表（如果有相關 BIM 屬性 Model）

    conn.close()
    return conversion


def get_conversion_version(bim_model) -> int:

    last_conversion = forge_models.BIMConversion.objects.filter(bim_model=bim_model).order_by("-version").first()
    new_version = 1 if last_conversion is None else last_conversion.version + 1  # 取得最新版本 +1

    return new_version

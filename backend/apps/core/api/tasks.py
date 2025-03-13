import os
import docker

from datetime import datetime

from django.conf import settings

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from celery import shared_task
from celery.utils.log import get_task_logger


logger = get_task_logger(__name__)


@shared_task
def backup_database():
    # 使用 volume 映射的宿主機備份目錄
    backup_dir = "/backups"
    timestamp = datetime.now().strftime("%Y-%m-%d-%H-%M-%S")
    backup_file = f"{backup_dir}/{timestamp}.bak"  # 使用已定義的變數

    db_name = settings.DATABASES["default"]["NAME"]
    db_user = settings.DATABASES["default"]["USER"]
    db_password = settings.DATABASES["default"].get("PASSWORD", "")

    # 初始化 Docker 客戶端
    client = docker.from_env()

    try:
        # 取得指定名稱的容器
        container = client.containers.get("postgres")

        command = f"pg_dump -U {db_user} -F c -f {backup_file} -d {db_name}"

        # 在容器內執行 pg_dump 命令來進行資料庫備份，並使用 backup_file
        exec_result = container.exec_run(
            command,
            stdin=True,  # 啟用標準輸入
            tty=True,    # 啟用 tty
            environment={"PGPASSWORD": db_password}  # 使用環境變數傳遞密碼
        )
        return {"status": "Backup completed", "file": f"{timestamp}.bak"}
    except docker.errors.NotFound:
        # 當容器不存在時，拋出錯誤
        raise Exception("容器不存在")
    except Exception as e:
        # 其他錯誤直接拋出
        raise Exception(f"無法執行備份: {str(e)}")


@shared_task()
def restore_database():
    # 定義備份目錄
    backup_dir = os.path.join(settings.MEDIA_ROOT, "backups")

    # 確保備份目錄存在
    if not os.path.exists(backup_dir):
        raise Exception(f"備份目錄 {backup_dir} 不存在")

    # 取得目錄中的所有檔案
    backups = [f for f in os.listdir(backup_dir) if os.path.isfile(os.path.join(backup_dir, f))]
    if not backups:
        raise Exception("備份目錄沒有任何檔案")

    # 根據檔案名稱排序，取出最新的備份檔案
    backups.sort(reverse=True)  # 降序排列，最新的檔案排在最前面
    latest_backup = backups[0]

    backup_file = os.path.join(backup_dir, latest_backup)

    db_name = settings.DATABASES["default"]["NAME"]
    db_user = settings.DATABASES["default"]["USER"]
    db_password = settings.DATABASES["default"].get("PASSWORD", "")

    # 初始化 Docker 客戶端
    client = docker.from_env()

    try:
        # 取得指定名稱的容器
        container = client.containers.get("postgres")

        # 使用 pg_restore 指令還原資料庫
        command = f"pg_restore -U {db_user} -d {db_name} --clean --if-exists /backups/{latest_backup}"

        # 在容器內執行 pg_restore 命令來還原資料庫
        exec_result = container.exec_run(
            command,
            stdin=True,  # 啟用標準輸入
            tty=True,    # 啟用 tty
            environment={"PGPASSWORD": db_password}   # 使用環境變數傳遞密碼
        )

        return {"status": "Restore completed", "backup_file": backup_file}
    except docker.errors.NotFound:
        raise Exception("容器不存在")
    except Exception as e:
        raise Exception(f"無法執行還原: {str(e)}")

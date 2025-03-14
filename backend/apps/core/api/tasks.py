import os
import docker

from datetime import datetime

from django.conf import settings

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from celery import shared_task
from celery.utils.log import get_task_logger


logger = get_task_logger(__name__)

GROUP_NAME = "database_group"


def send_progress(status, message, task=None, file=None):
    """發送進度訊息到 WebSocket，並可選更新 Celery 任務狀態"""
    try:
        channel_layer = get_channel_layer()
        payload = {
            'type': 'database.message',
            'status': status,
            'message': message,
            'file': file
        }
        async_to_sync(channel_layer.group_send)('database_group', payload)

        # 如果提供了 task 物件，更新 Celery 任務狀態
        if task:
            task.update_state(state='PROGRESS', meta=payload)
    except Exception as e:
        logger.error(f"Failed to send progress: {str(e)}")


@shared_task(bind=True)
def backup_database(self):
    """備份資料庫並透過 WebSocket 傳送即時進度訊息"""
    backup_dir = "/backups"
    timestamp = datetime.now().strftime("%Y-%m-%d-%H-%M-%S")
    backup_file = f"{backup_dir}/{timestamp}.bak"

    db_name = settings.DATABASES["default"]["NAME"]
    db_user = settings.DATABASES["default"]["USER"]
    db_password = settings.DATABASES["default"].get("PASSWORD", "")

    # 初始化 Docker 客戶端
    send_progress("starting", "正在初始化備份任務...", task=self)
    try:
        client = docker.from_env()
        container = client.containers.get("postgres")
    except docker.errors.NotFound:
        send_progress("error", "容器不存在", task=self)
        raise Exception("容器不存在")
    except Exception as e:
        send_progress("error", f"初始化失敗: {str(e)}", task=self)
        raise Exception(f"無法初始化 Docker 客戶端: {str(e)}")

    # 開始備份
    command = f"pg_dump -U {db_user} -F c -f {backup_file} -d {db_name} --verbose"
    send_progress("running", "開始執行資料庫備份...", task=self)

    try:
        # 使用 exec_create 和 exec_start 獲取流式輸出
        exec_id = client.api.exec_create(
            container.id,
            command,
            stdin=True,
            tty=True,
            environment={"PGPASSWORD": db_password}
        )
        output = client.api.exec_start(exec_id, stream=True)

        # 逐行讀取輸出並發送進度
        for line in output:
            decoded_line = line.decode('utf-8').strip()
            if decoded_line:  # 確保不發送空行
                send_progress("running", f"備份進度: {decoded_line}", task=self)
                logger.info(f"備份進度: {decoded_line}")

        # 檢查執行結果
        exec_result = client.api.exec_inspect(exec_id)
        if exec_result['ExitCode'] != 0:
            send_progress("error", "備份失敗，檢查日誌以獲取詳細資訊", task=self)
            raise Exception("pg_dump 執行失敗")

        send_progress("completed", f"備份完成，檔案: {timestamp}.bak", task=self, file=f"{timestamp}.bak")
        return {"completed": f"備份完成，檔案: {timestamp}.bak"}
    except Exception as e:
        send_progress("error", f"無法執行備份: {str(e)}", task=self)
        raise


@shared_task(bind=True)
def restore_database(self):
    """還原資料庫並透過 WebSocket 傳送即時進度訊息"""
    backup_dir = os.path.join(settings.MEDIA_ROOT, "backups")

    # 檢查備份目錄
    send_progress("starting", "正在檢查備份目錄...", task=self)
    if not os.path.exists(backup_dir):
        send_progress("error", f"備份目錄 {backup_dir} 不存在", task=self)
        raise Exception(f"備份目錄 {backup_dir} 不存在")

    backups = [f for f in os.listdir(backup_dir) if os.path.isfile(os.path.join(backup_dir, f))]
    if not backups:
        send_progress("error", "備份目錄沒有任何檔案", task=self)
        raise Exception("備份目錄沒有任何檔案")

    backups.sort(reverse=True)
    latest_backup = backups[0]
    backup_file = os.path.join(backup_dir, latest_backup)

    db_name = settings.DATABASES["default"]["NAME"]
    db_user = settings.DATABASES["default"]["USER"]
    db_password = settings.DATABASES["default"].get("PASSWORD", "")

    # 初始化 Docker 客戶端
    send_progress("running", "正在初始化還原任務...", task=self)
    try:
        client = docker.from_env()
        container = client.containers.get("postgres")
    except docker.errors.NotFound:
        send_progress("error", "容器不存在", task=self)
        raise Exception("容器不存在")
    except Exception as e:
        send_progress("error", f"初始化失敗: {str(e)}", task=self)
        raise Exception(f"無法初始化 Docker 客戶端: {str(e)}")

    # 開始還原
    command = f"pg_restore -U {db_user} -d {db_name} --clean --if-exists --verbose /backups/{latest_backup}"
    send_progress("running", f"開始還原資料庫，使用檔案: {latest_backup}", task=self)

    try:
        # 使用 exec_create 和 exec_start 獲取流式輸出
        exec_id = client.api.exec_create(
            container.id,
            command,
            stdin=True,
            tty=True,
            environment={"PGPASSWORD": db_password}
        )
        output = client.api.exec_start(exec_id, stream=True)

        # 逐行讀取輸出並發送進度
        for line in output:
            decoded_line = line.decode('utf-8').strip()
            if decoded_line:  # 確保不發送空行
                send_progress("running", f"還原進度: {decoded_line}", task=self)
                logger.info(f"還原進度: {decoded_line}")

        # 檢查執行結果
        exec_result = client.api.exec_inspect(exec_id)
        if exec_result['ExitCode'] != 0:
            send_progress("error", "還原失敗，檢查日誌以獲取詳細資訊", task=self)
            raise Exception("pg_restore 執行失敗")

        send_progress("completed", f"還原完成，使用的備份檔案: {latest_backup}", task=self)
        return {"status": "Restore completed", "backup_file": latest_backup}
    except Exception as e:
        send_progress("error", f"無法執行還原: {str(e)}", task=self)
        raise

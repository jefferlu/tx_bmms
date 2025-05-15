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
    backup_dir = "backups"
    timestamp = datetime.now().strftime("%Y-%m-%d-%H-%M-%S")
    host_backup_path = os.path.join(settings.MEDIA_ROOT, backup_dir)
    os.makedirs(host_backup_path, exist_ok=True)
    container_backup_file = f"/backups/{timestamp}.bak"

    db_name = settings.DATABASES["default"]["NAME"]
    db_user = settings.DATABASES["default"]["USER"]
    db_password = settings.DATABASES["default"].get("PASSWORD", "")

    send_progress("starting", "Initializing backup task...", task=self)
    try:
        client = docker.from_env()
        container = client.containers.get("bmms_postgres")
    except docker.errors.NotFound:
        send_progress("error", "Container not found", task=self)
        raise Exception("Container not found")
    except Exception as e:
        send_progress("error", f"Initialization failed: {str(e)}", task=self)
        raise Exception(f"Unable to initialize Docker client: {str(e)}")

    try:
        exec_id = client.api.exec_create(
            container.id,
            ["/bin/sh", "-c", "mkdir -p /backups && chmod -R 777 /backups"],
            user="root",
            stdout=True,
            stderr=True
        )
        output = client.api.exec_start(exec_id, stream=True)
        error_output = []
        for line in output:
            decoded_line = line.decode('utf-8').strip()
            if decoded_line:
                error_output.append(decoded_line)
                logger.error(f"Directory setup output: {decoded_line}")
        exec_result = client.api.exec_inspect(exec_id)
        if exec_result['ExitCode'] != 0:
            error_msg = "Failed to create or set permissions for backup directory"
            if error_output:
                error_msg += f": {', '.join(error_output)}"
            send_progress("error", error_msg, task=self)
            raise Exception(error_msg)
    except Exception as e:
        send_progress("error", f"Failed to prepare backup directory: {str(e)}", task=self)
        raise

    command = f"pg_dump -U {db_user} -F c -f {container_backup_file} -d {db_name} --verbose"
    send_progress("running", "Starting database backup...", task=self)

    try:
        exec_id = client.api.exec_create(
            container.id,
            command,
            stdin=True,
            tty=True,
            environment={"PGPASSWORD": db_password}
        )
        output = client.api.exec_start(exec_id, stream=True)

        for line in output:
            decoded_line = line.decode('utf-8').strip()
            if decoded_line:
                send_progress("running", f"Backup progress: {decoded_line}", task=self)
                logger.info(f"Backup progress: {decoded_line}")
                if "error" in decoded_line.lower():
                    logger.error(f"pg_dump error: {decoded_line}")

        exec_result = client.api.exec_inspect(exec_id)
        if exec_result['ExitCode'] != 0:
            send_progress("error", "Backup failed, check logs for details", task=self)
            raise Exception("pg_dump execution failed")

        send_progress("completed", f"Backup completed, file: {timestamp}.bak", task=self, file=f"{timestamp}.bak")
        return {"completed": f"Backup completed, file: {timestamp}.bak"}
    except Exception as e:
        send_progress("error", f"Unable to perform backup: {str(e)}", task=self)
        raise


@shared_task(bind=True)
def restore_database(self):
    """還原資料庫並透過 WebSocket 傳送即時進度訊息"""
    backup_dir = os.path.join(settings.MEDIA_ROOT, "backups")

    # 檢查備份目錄
    send_progress("starting", "Checking backup directory...", task=self)
    if not os.path.exists(backup_dir):
        send_progress("error", f"Backup directory {backup_dir} does not exist", task=self)
        raise Exception(f"Backup directory {backup_dir} does not exist")

    backups = [f for f in os.listdir(backup_dir) if os.path.isfile(os.path.join(backup_dir, f))]
    if not backups:
        send_progress("error", "No files found in backup directory", task=self)
        raise Exception("No files found in backup directory")

    backups.sort(reverse=True)
    latest_backup = backups[0]
    backup_file = os.path.join(backup_dir, latest_backup)

    db_name = settings.DATABASES["default"]["NAME"]
    db_user = settings.DATABASES["default"]["USER"]
    db_password = settings.DATABASES["default"].get("PASSWORD", "")

    # 初始化 Docker 客戶端
    send_progress("running", "Initializing restore task...", task=self)
    try:
        client = docker.from_env()
        container = client.containers.get("bmms_postgres")
    except docker.errors.NotFound:
        send_progress("error", "Container not found", task=self)
        raise Exception("Container not found")
    except Exception as e:
        send_progress("error", f"Initialization failed: {str(e)}", task=self)
        raise Exception(f"Unable to initialize Docker client: {str(e)}")

    # 開始還原
    command = f"pg_restore -U {db_user} -d {db_name} --clean --if-exists --verbose /backups/{latest_backup}"
    send_progress("running", f"Starting database restore, using file: {latest_backup}", task=self)

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
            if decoded_line:  # Ensure empty lines are not sent
                send_progress("running", f"Restore progress: {decoded_line}", task=self)
                logger.info(f"Restore progress: {decoded_line}")

        # 檢查執行結果
        exec_result = client.api.exec_inspect(exec_id)
        if exec_result['ExitCode'] != 0:
            send_progress("error", "Restore failed, check logs for details", task=self)
            raise Exception("pg_restore execution failed")

        send_progress("completed", f"Restore completed, used backup file: {latest_backup}", task=self)
        return {"status": "Restore completed", "backup_file": latest_backup}
    except Exception as e:
        send_progress("error", f"Unable to perform restore: {str(e)}", task=self)
        raise

#!/bin/bash

# 定義等待資料庫準備的函數
function wait_for_db() {
  while ! python manage.py sqlflush > /dev/null 2>&1; do
    echo "Waiting for the database to be ready..."
    sleep 1
  done
  echo "Database is ready!"
}

# 等待資料庫啟動完成
wait_for_db

# 執行資料庫遷移
echo "Running database migrations..."
python manage.py migrate --noinput

# 收集靜態文件
echo "Collecting static files..."
python manage.py collectstatic --noinput

# 建立超級用戶 (初使需要的管理者權限，可選步驟）
echo "Creating superuser..."
python manage.py shell -c "from django.contrib.auth import get_user_model; \
User = get_user_model()
if not User.objects.filter(email='admin@example.com').exists(): \
    User.objects.create_superuser('admin@example.com', '123')"

# 啟動 Celery Worker
echo "Starting Celery Worker..."
celery -A tx_bmms worker --loglevel=info &  # 使用&將其放到背景
# celery -A tx_bmms worker --pool=solo --loglevel=info # for windows os

# 啟動 Daphne
echo "Starting Daphne..."
# exec gunicorn --bind 0.0.0.0:81 tx_bmms.wsgi:application
exec daphne tx_bmms.asgi:application -b 0.0.0.0 -p 80  
# celery -A tx_bmms  worker --loglevel=info    
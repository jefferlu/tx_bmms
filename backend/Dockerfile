FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

COPY settings_docker.py ./tx_bmms/settings.py

# 啟動 Gunicorn
# CMD ["gunicorn", "--bind", "0.0.0.0:80", "tx_bmms.wsgi:application"]
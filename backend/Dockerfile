FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

COPY settings_docker.py ./tx_bmms/settings.py

RUN chmod +x entrypoint.sh

# 啟動 Gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:80", "tx_bmms.wsgi:application"]
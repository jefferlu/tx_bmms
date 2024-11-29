FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN python manage.py collectstatic --noinput


# 啟動 Gunicorn 和 Nginx
CMD ["gunicorn", "--bind", "0.0.0.0:80", "tx_bmms.wsgi:application"]
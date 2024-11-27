FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN python manage.py collectstatic --noinput

# 安裝 Nginx
RUN apt-get update && apt-get install -y nginx

COPY ./nginx/nginx.conf /etc/nginx/conf.d/default.conf

# 開放端口
EXPOSE 8000
EXPOSE 80

# 啟動 Gunicorn 和 Nginx
CMD ["sh", "-c", "gunicorn --bind unix:/run/gunicorn.sock tx_bmms.wsgi:application & nginx -g 'daemon off;'"]
# 使用 PHP 與 FPM 的基礎映像
FROM php:8.2-fpm

# 設定工作目錄
WORKDIR /app

# 安裝 elFinder 需要的基本依賴（去除不必要的庫）
RUN apt update && apt install -y \
    unzip \
    git \
    nginx \
    && apt clean && rm -rf /var/lib/apt/lists/*

# 複製 elFinder
COPY . .

RUN mkdir -p media-files media-files/.trash && \
    chown -R www-data:www-data media-files && \
    chmod -R 755 media-files

# 複製 Nginx 配置文件
COPY ./nginx.conf /etc/nginx/sites-available/default

# 啟動服務
CMD ["sh", "-c", "php-fpm & nginx -g 'daemon off;'"]
# 使用 PHP 與 FPM 的基礎映像
FROM php:8.2-fpm

# 設定工作目錄
WORKDIR /app

# 安裝 elFinder 需要的基本依賴（去除不必要的庫）
RUN apt-get update && apt-get install -y \
    unzip \
    git \
    nginx \
    locales \
    fonts-noto-cjk \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# 生成所需的 UTF-8 語系
# RUN locale-gen en_US.UTF-8 && locale-gen zh_TW.UTF-8

# 設置默認語系為 UTF-8
ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8

# 複製 elFinder
COPY . .

RUN mkdir media-files /app/media-files/.trash && \
    chown -R www-data:www-data /app/media-files && \
    chmod -R 755 /app/media-files

# 複製 Nginx 配置文件
COPY ./nginx.conf /etc/nginx/sites-available/default

# 啟動服務
CMD ["sh", "-c", "php-fpm & nginx -g 'daemon off;'"]
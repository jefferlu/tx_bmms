FROM python:3.11-slim

# 設定環境變數以優化 Python 行為
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

WORKDIR /app

# 安裝 Supervisor 和其他系統依賴
RUN apt-get update && apt-get install -y \
    supervisor \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x entrypoint.sh

# 複製 supervisor 配置檔案
COPY ./supervisord.conf /etc/supervisord.conf

# 設定容器啟動時執行 entrypoint（會先初始化再啟動 supervisor）
CMD ["./entrypoint.sh"]

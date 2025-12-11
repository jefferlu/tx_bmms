# Docker Compose 配置更新 - VerneMQ MQTT Broker

## 完整的 docker-compose.yml 範例

```yaml
version: '3.8'

services:
  # Backend API (Django)
  backend:
    build: ./backend
    container_name: tx_bmms_backend
    restart: always
    command: python manage.py runserver 0.0.0.0:8000
    volumes:
      - ./backend:/app
    ports:
      - "8100:8000"
    environment:
      - DEBUG=True
      - DJANGO_SETTINGS_MODULE=backend.settings
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/bmms
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - MQTT_BROKER_HOST=vernemq
      - MQTT_BROKER_PORT=1883
    depends_on:
      - db
      - redis
      - vernemq
    networks:
      - internal_network

  # Frontend (Angular)
  client:
    build: ./client
    container_name: tx_bmms_client
    restart: always
    volumes:
      - ./client:/app
      - /app/node_modules
    ports:
      - "4000:80"
    depends_on:
      - backend
    networks:
      - internal_network

  # PostgreSQL Database
  db:
    image: postgres:14-alpine
    container_name: tx_bmms_db
    restart: always
    environment:
      - POSTGRES_DB=bmms
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    volumes:
      - ./db/data:/var/lib/postgresql/data
    ports:
      - "5433:5432"
    networks:
      - internal_network

  # Redis Cache & Message Queue
  redis:
    image: redis:7-alpine
    container_name: tx_bmms_redis
    restart: always
    command: redis-server --appendonly yes --requirepass ""
    volumes:
      - ./redis/data:/data
    ports:
      - "6379:6379"
    networks:
      - internal_network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

  # MQTT Broker - VerneMQ
  vernemq:
    image: vernemq/vernemq:latest
    container_name: tx_bmms_vernemq
    restart: always
    hostname: vernemq
    environment:
      # ===== 基本設定 =====
      # 接受 EULA
      DOCKER_VERNEMQ_ACCEPT_EULA: 'yes'
      
      # 允許匿名連線 (開發環境: on, 生產環境: off)
      DOCKER_VERNEMQ_ALLOW_ANONYMOUS: 'on'
      
      # ===== Listeners 設定 =====
      # MQTT TCP Listener (標準 MQTT 協議, Port 1883)
      DOCKER_VERNEMQ_LISTENER__TCP__DEFAULT: '0.0.0.0:1883'
      
      # MQTT WebSocket Listener (瀏覽器使用, Port 8083)
      DOCKER_VERNEMQ_LISTENER__WS__DEFAULT: '0.0.0.0:8083'
      
      # MQTT WebSocket Secure Listener (HTTPS 網頁使用, Port 8084)
      # 需要 SSL 憑證才能啟用
      # DOCKER_VERNEMQ_LISTENER__WSS__DEFAULT: '0.0.0.0:8084'
      
      # ===== Log 設定 =====
      DOCKER_VERNEMQ_LOG__CONSOLE__LEVEL: 'info'
      DOCKER_VERNEMQ_LOG__CONSOLE__FILE: '/vernemq/log/vernemq.log'
      
      # ===== SSL/TLS 憑證設定 (生產環境) =====
      # 取消註解並設定正確的憑證路徑
      # DOCKER_VERNEMQ_LISTENER__WSS__CAFILE: '/etc/letsencrypt/live/your-domain.com/fullchain.pem'
      # DOCKER_VERNEMQ_LISTENER__WSS__CERTFILE: '/etc/letsencrypt/live/your-domain.com/cert.pem'
      # DOCKER_VERNEMQ_LISTENER__WSS__KEYFILE: '/etc/letsencrypt/live/your-domain.com/privkey.pem'
      
      # ===== 效能與限制設定 =====
      # Client ID 最大長度
      DOCKER_VERNEMQ_MAX_CLIENT_ID_SIZE: '100'
      
      # 離線消息隊列大小
      DOCKER_VERNEMQ_MAX_OFFLINE_MESSAGES: '1000'
      
      # 在線消息隊列大小
      DOCKER_VERNEMQ_MAX_ONLINE_MESSAGES: '1000'
      
      # 最大連線數 (根據需求調整)
      # DOCKER_VERNEMQ_MAX_CONNECTIONS: '10000'
      
      # ===== 持久化設定 =====
      # 啟用消息持久化
      DOCKER_VERNEMQ_PERSISTENCE: 'on'
      DOCKER_VERNEMQ_PERSISTENCE_DIR: '/vernemq/data'
      
      # ===== 其他選用設定 =====
      # 心跳間隔 (秒)
      # DOCKER_VERNEMQ_KEEPALIVE: '60'
      
      # 啟用 WebSocket 路徑
      # DOCKER_VERNEMQ_LISTENER__WS__DEFAULT__WEBSOCKETS__PATH: '/mqtt'
      
    ports:
      # MQTT TCP (標準 MQTT 協議)
      - "1883:1883"
      
      # MQTT WebSocket (瀏覽器連線)
      - "8083:8083"
      
      # MQTT WebSocket Secure (需要 SSL)
      # - "8084:8084"
      
      # VerneMQ HTTP API (管理介面，可選)
      # - "8888:8888"
      
      # VerneMQ Metrics (Prometheus, 可選)
      # - "8888:8888"
      
    volumes:
      # SSL 憑證 (如果有的話，唯讀)
      - /etc/letsencrypt:/etc/letsencrypt:ro
      
      # Log 目錄
      - ./vernemq/log:/vernemq/log
      
      # 持久化數據目錄 (訂閱、保留消息等)
      - ./vernemq/data:/vernemq/data
      
    networks:
      - internal_network
      
    healthcheck:
      test: ["CMD", "vernemq", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # File Manager (elFinder)
  elfinder:
    build: ./elfinder
    container_name: tx_bmms_elfinder
    restart: always
    volumes:
      - ./elfinder/files:/var/www/html/files
    ports:
      - "8080:80"
    networks:
      - internal_network

networks:
  internal_network:
    driver: bridge

volumes:
  db_data:
  redis_data:
  vernemq_data:
  vernemq_log:
```

---

## 環境變數設定 (.env)

建立或更新 `.env` 檔案：

```bash
# ===== Database =====
DATABASE_URL=postgresql://postgres:postgres@db:5432/bmms
POSTGRES_DB=bmms
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# ===== Redis =====
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=

# ===== MQTT Broker (VerneMQ) =====
MQTT_BROKER_HOST=vernemq
MQTT_BROKER_PORT=1883
MQTT_BROKER_WS_PORT=8083
MQTT_BROKER_WSS_PORT=8084
MQTT_BROKER_USERNAME=
MQTT_BROKER_PASSWORD=
MQTT_KEEPALIVE=60
MQTT_CLIENT_ID_PREFIX=tx_bmms

# ===== Sensor Data Settings =====
SENSOR_DATA_SAVE_TO_DB=False
SENSOR_DATA_RETENTION_HOURS=168
SENSOR_DATA_UPDATE_INTERVAL=5

# ===== Django Settings =====
DEBUG=True
SECRET_KEY=your-secret-key-here
ALLOWED_HOSTS=localhost,127.0.0.1

# ===== Forge/APS Settings =====
FORGE_CLIENT_ID=your-client-id
FORGE_CLIENT_SECRET=your-client-secret
```

---

## 初始化步驟

### 1. 建立必要的目錄

```bash
# 在專案根目錄執行
mkdir -p vernemq/log
mkdir -p vernemq/data
mkdir -p redis/data
mkdir -p db/data

# 設定權限
chmod -R 755 vernemq
chmod -R 755 redis
chmod -R 755 db
```

### 2. 啟動服務

```bash
# 停止所有服務 (如果正在運行)
docker-compose down

# 重新建構並啟動
docker-compose up -d --build

# 查看服務狀態
docker-compose ps

# 查看日誌
docker-compose logs -f
```

### 3. 驗證 VerneMQ 連線

```bash
# 查看 VerneMQ 日誌
docker-compose logs -f vernemq

# 進入 VerneMQ 容器
docker-compose exec vernemq sh

# 檢查 VerneMQ 狀態
vernemq ping

# 查看連線的 clients
vernemq-admin session show

# 查看訂閱
vernemq-admin listener show
```

### 4. 測試 MQTT 連線

使用 mosquitto_sub 和 mosquitto_pub 測試：

```bash
# Terminal 1: 訂閱
mosquitto_sub -h localhost -p 1883 -t "test/#" -v

# Terminal 2: 發布
mosquitto_pub -h localhost -p 1883 -t "test/message" -m "Hello MQTT"
```

---

## VerneMQ 生產環境設定

### 啟用身份驗證

生產環境應該關閉匿名連線並啟用身份驗證：

```yaml
environment:
  # 關閉匿名連線
  DOCKER_VERNEMQ_ALLOW_ANONYMOUS: 'off'
  
  # 使用內建的密碼檔案認證
  DOCKER_VERNEMQ_PLUGINS__VMQ_PASSWD: 'on'
  
  # 或使用資料庫認證 (PostgreSQL)
  # DOCKER_VERNEMQ_PLUGINS__VMQ_DIVERSITY: 'on'
  # DOCKER_VERNEMQ_VMQ_DIVERSITY__POSTGRES__HOST: 'db'
  # DOCKER_VERNEMQ_VMQ_DIVERSITY__POSTGRES__PORT: '5432'
  # DOCKER_VERNEMQ_VMQ_DIVERSITY__POSTGRES__USER: 'postgres'
  # DOCKER_VERNEMQ_VMQ_DIVERSITY__POSTGRES__PASSWORD: 'postgres'
  # DOCKER_VERNEMQ_VMQ_DIVERSITY__POSTGRES__DATABASE: 'vernemq'
```

建立使用者：

```bash
# 進入 VerneMQ 容器
docker-compose exec vernemq sh

# 建立使用者
vmq-passwd /etc/vernemq/vmq.passwd username
# 輸入密碼

# 重新載入設定
vernemq-admin reload
```

### 啟用 SSL/TLS

```yaml
environment:
  # 啟用 WSS Listener
  DOCKER_VERNEMQ_LISTENER__WSS__DEFAULT: '0.0.0.0:8084'
  
  # 設定憑證
  DOCKER_VERNEMQ_LISTENER__WSS__CAFILE: '/etc/letsencrypt/live/your-domain.com/fullchain.pem'
  DOCKER_VERNEMQ_LISTENER__WSS__CERTFILE: '/etc/letsencrypt/live/your-domain.com/cert.pem'
  DOCKER_VERNEMQ_LISTENER__WSS__KEYFILE: '/etc/letsencrypt/live/your-domain.com/privkey.pem'
```

### 啟用 HTTP API

VerneMQ 提供 HTTP API 用於管理：

```yaml
environment:
  # 啟用 HTTP API
  DOCKER_VERNEMQ_LISTENER__HTTP__DEFAULT: '0.0.0.0:8888'

ports:
  - "8888:8888"
```

API 端點範例：

```bash
# 查看所有 clients
curl http://localhost:8888/api/v1/session/show

# 斷開特定 client
curl -X DELETE http://localhost:8888/api/v1/session/disconnect/client_id
```

---

## VerneMQ 效能調優

### 高併發設定

```yaml
environment:
  # 增加最大連線數
  DOCKER_VERNEMQ_MAX_CONNECTIONS: '50000'
  
  # 增加訊息隊列大小
  DOCKER_VERNEMQ_MAX_ONLINE_MESSAGES: '10000'
  DOCKER_VERNEMQ_MAX_OFFLINE_MESSAGES: '10000'
  
  # 調整緩衝區大小
  DOCKER_VERNEMQ_SYSTREE_INTERVAL: '20'
  
  # 啟用訊息壓縮
  DOCKER_VERNEMQ_ALLOW_MESSAGE_EXPIRY: 'on'
```

### 資源限制

```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
    reservations:
      cpus: '1'
      memory: 1G
```

---

## 監控與日誌

### 日誌設定

```yaml
environment:
  # 日誌等級: debug, info, warning, error
  DOCKER_VERNEMQ_LOG__CONSOLE__LEVEL: 'info'
  
  # 日誌輸出
  DOCKER_VERNEMQ_LOG__CONSOLE__FILE: '/vernemq/log/vernemq.log'
  
  # 啟用錯誤日誌
  DOCKER_VERNEMQ_LOG__ERROR__FILE: '/vernemq/log/error.log'
```

### 查看日誌

```bash
# 即時查看日誌
docker-compose logs -f vernemq

# 查看最近 100 行
docker-compose logs --tail=100 vernemq

# 查看日誌檔案
docker-compose exec vernemq tail -f /vernemq/log/vernemq.log
```

### Prometheus 監控

VerneMQ 支援 Prometheus metrics：

```yaml
environment:
  # 啟用 Prometheus 輸出
  DOCKER_VERNEMQ_PLUGINS__VMQ_PROMETHEUS: 'on'
  DOCKER_VERNEMQ_PROMETHEUS__PORT: '8888'

ports:
  - "8888:8888"
```

Prometheus 設定：

```yaml
scrape_configs:
  - job_name: 'vernemq'
    static_configs:
      - targets: ['localhost:8888']
```

---

## 常見問題排除

### 1. VerneMQ 無法啟動

```bash
# 檢查日誌
docker-compose logs vernemq

# 檢查權限
ls -la vernemq/

# 清除數據重新開始
rm -rf vernemq/data/*
docker-compose restart vernemq
```

### 2. 連線被拒絕

```bash
# 檢查 VerneMQ 是否正在監聽
docker-compose exec vernemq netstat -tlnp

# 檢查防火牆
sudo ufw status
sudo ufw allow 1883/tcp
sudo ufw allow 8083/tcp
```

### 3. 消息無法接收

```bash
# 檢查訂閱
docker-compose exec vernemq vernemq-admin session show

# 檢查 topic 權限
docker-compose exec vernemq vernemq-admin acl show
```

### 4. 效能問題

```bash
# 查看系統資源使用
docker stats tx_bmms_vernemq

# 查看連線數
docker-compose exec vernemq vernemq-admin metrics show | grep socket_count

# 查看訊息隊列
docker-compose exec vernemq vernemq-admin metrics show | grep queue
```

---

## VerneMQ vs Mosquitto 比較

| 特性 | VerneMQ | Mosquitto |
|------|---------|-----------|
| 叢集支援 | ✅ 內建 | ❌ 需要 bridge |
| 效能 | ⚡ 高 (Erlang/OTP) | 中等 |
| 插件系統 | ✅ 豐富 | ✅ 基本 |
| 管理介面 | ✅ HTTP API | ❌ |
| WebSocket | ✅ | ✅ |
| 設定複雜度 | 中等 | 簡單 |
| 記憶體使用 | 較高 | 較低 |

**選擇 VerneMQ 的理由：**
- 需要高併發 (>10k 連線)
- 需要叢集部署
- 需要進階功能 (插件、監控)
- 企業級應用

**選擇 Mosquitto 的理由：**
- 簡單場景 (<1k 連線)
- 資源受限環境
- 快速原型開發

---

## 備份與還原

### 備份 VerneMQ 數據

```bash
# 停止 VerneMQ
docker-compose stop vernemq

# 備份數據目錄
tar -czf vernemq_backup_$(date +%Y%m%d).tar.gz vernemq/data

# 啟動 VerneMQ
docker-compose start vernemq
```

### 還原數據

```bash
# 停止 VerneMQ
docker-compose stop vernemq

# 清除現有數據
rm -rf vernemq/data/*

# 還原備份
tar -xzf vernemq_backup_YYYYMMDD.tar.gz

# 啟動 VerneMQ
docker-compose start vernemq
```

---

## 擴展閱讀

- [VerneMQ 官方文檔](https://docs.vernemq.com/)
- [MQTT 5.0 規範](https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html)
- [VerneMQ Docker Hub](https://hub.docker.com/r/vernemq/vernemq)
- [VerneMQ GitHub](https://github.com/vernemq/vernemq)

---

**版本**: 1.0  
**更新日期**: 2025-12-11  
**適用專案**: tx_bmms IoT Integration

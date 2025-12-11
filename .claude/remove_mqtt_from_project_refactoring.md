# 移除專案內 MQTT 容器 - 架構重構文件

## 🎯 重構目標

**將 MQTT Broker 從專案的 docker-compose.yml 中移除，改為連線到 Server 上的統一 MQTT 服務。**

---

## ❓ 為什麼要移除？

### 錯誤架構（Before）
```
專案 A (docker-compose)
  ├── backend
  ├── frontend
  ├── db
  └── vernemq (❌ 獨立的 MQTT)

專案 B (docker-compose)
  ├── backend
  ├── frontend
  ├── db
  └── vernemq (❌ 獨立的 MQTT)
```

**問題：**
1. ❌ 每個專案都有獨立的 MQTT Broker
2. ❌ Broker 之間狀態不共享（publish/subscribe 無法跨專案）
3. ❌ Port 衝突（1883、8083 只能被一個服務綁定）
4. ❌ 外部設備（ESP32、感測器）無法決定要連哪個 Broker
5. ❌ 資源浪費（每個 Broker 都佔用記憶體）

### 正確架構（After）
```
Server 層級
  └── MQTT Broker (VerneMQ/Mosquitto)
       ├── Port: 1883 (MQTT TCP)
       ├── Port: 8883 (MQTTS)
       └── Port: 8083 (WebSocket)

專案層級
  ├── 專案 A
  │   ├── backend ──┐
  │   ├── frontend ─┼─> 連線到 Server 的 MQTT
  │   └── db       ─┘
  │
  └── 專案 B
      ├── backend ──┐
      ├── frontend ─┼─> 連線到 Server 的 MQTT
      └── db       ─┘

外部設備
  └── ESP32/感測器 ──> 連線到 Server 的 MQTT
```

**優點：**
1. ✅ 全域只有一個 MQTT Broker
2. ✅ 所有專案/設備共享同一個 Broker
3. ✅ Topic 可以跨專案訂閱（如果需要）
4. ✅ 集中管理（認證、ACL、監控）
5. ✅ 外部設備只需要記住一個連線位置

---

## 🔧 移除步驟

### Step 1: 移除 docker-compose.yml 中的 VerneMQ 服務

**移除以下整段：**

```yaml
# ❌ 移除這整段
vernemq:
  image: vernemq/vernemq:latest
  container_name: tx_bmms_vernemq
  restart: always
  hostname: vernemq
  environment:
    DOCKER_VERNEMQ_ACCEPT_EULA: 'yes'
    DOCKER_VERNEMQ_ALLOW_ANONYMOUS: 'on'
    DOCKER_VERNEMQ_LISTENER__TCP__DEFAULT: '0.0.0.0:1883'
    DOCKER_VERNEMQ_LISTENER__WS__DEFAULT: '0.0.0.0:8083'
    # ... 其他設定
  ports:
    - "1883:1883"
    - "8083:8083"
  volumes:
    - /etc/letsencrypt:/etc/letsencrypt:ro
    - ./vernemq/log:/vernemq/log
    - ./vernemq/data:/vernemq/data
  networks:
    - internal_network
  healthcheck:
    test: ["CMD", "vernemq", "ping"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
```

### Step 2: 移除相關的 volumes 定義

如果在 docker-compose.yml 底部有定義 volumes：

```yaml
# ❌ 移除這些（如果有）
volumes:
  vernemq_data:
  vernemq_log:
```

### Step 3: 移除本地目錄

```bash
# 移除 VerneMQ 相關目錄
rm -rf vernemq/
```

### Step 4: 更新 backend 的 depends_on

在 `backend` 服務中移除對 vernemq 的依賴：

**Before:**
```yaml
backend:
  # ...
  depends_on:
    - db
    - redis
    - vernemq  # ❌ 移除這行
```

**After:**
```yaml
backend:
  # ...
  depends_on:
    - db
    - redis
```

### Step 5: 更新環境變數

**docker-compose.yml - backend service:**

```yaml
backend:
  # ...
  environment:
    - MQTT_BROKER_HOST=your-server-ip-or-domain  # ✅ 改為 server 的 IP 或 domain
    - MQTT_BROKER_PORT=1883
    - MQTT_BROKER_WS_PORT=8083
```

**或使用 .env 檔案：**

```bash
# .env

# ===== MQTT Broker (Server 層級) =====
# 改為 server 的實際位置
MQTT_BROKER_HOST=bmms.yourdomain.com  # 或 123.456.789.0
MQTT_BROKER_PORT=1883
MQTT_BROKER_WS_PORT=8083
MQTT_BROKER_WSS_PORT=8884
MQTT_BROKER_USERNAME=your_username
MQTT_BROKER_PASSWORD=your_password
```

### Step 6: 更新前端環境變數

**client/src/environments/environment.ts:**

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8100/api',
  
  // ✅ 改為 server 的實際位置
  mqttBrokerHost: 'bmms.yourdomain.com',  // 或 'localhost' (開發時)
  mqttBrokerWsPort: 8083,
  sensorUpdateInterval: 5000,
};
```

**client/src/environments/environment.prod.ts:**

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://bmms.yourdomain.com/api',
  
  // ✅ 生產環境使用 server 的 domain
  mqttBrokerHost: 'bmms.yourdomain.com',
  mqttBrokerWsPort: 8083,
  sensorUpdateInterval: 5000,
};
```

---

## 📋 移除後的完整 docker-compose.yml 範例

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
      
      # ✅ MQTT 連線到 server
      - MQTT_BROKER_HOST=${MQTT_BROKER_HOST}
      - MQTT_BROKER_PORT=${MQTT_BROKER_PORT}
      - MQTT_BROKER_USERNAME=${MQTT_BROKER_USERNAME}
      - MQTT_BROKER_PASSWORD=${MQTT_BROKER_PASSWORD}
      
    depends_on:
      - db
      - redis
      # ❌ 移除了 vernemq
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
    command: redis-server --appendonly yes
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

# ❌ 移除了 vernemq 相關的 volumes
volumes:
  db_data:
  redis_data:
```

---

## 🖥️ Server 上部署獨立 MQTT Broker

### 選項 1: 使用 Docker Compose（推薦）

在 server 上建立獨立的 MQTT 服務：

```bash
# 建立目錄
mkdir -p /opt/mqtt-broker
cd /opt/mqtt-broker
```

**建立 docker-compose.yml：**

```yaml
# /opt/mqtt-broker/docker-compose.yml

version: '3.8'

services:
  vernemq:
    image: vernemq/vernemq:latest
    container_name: mqtt_broker
    restart: always
    hostname: mqtt-broker
    environment:
      # ===== 基本設定 =====
      DOCKER_VERNEMQ_ACCEPT_EULA: 'yes'
      
      # ⚠️ 生產環境應該改為 'off'，並啟用身份驗證
      DOCKER_VERNEMQ_ALLOW_ANONYMOUS: 'on'
      
      # ===== Listeners =====
      DOCKER_VERNEMQ_LISTENER__TCP__DEFAULT: '0.0.0.0:1883'
      DOCKER_VERNEMQ_LISTENER__WS__DEFAULT: '0.0.0.0:8083'
      
      # SSL/TLS (如果有憑證)
      # DOCKER_VERNEMQ_LISTENER__MQTTS__DEFAULT: '0.0.0.0:8883'
      # DOCKER_VERNEMQ_LISTENER__WSS__DEFAULT: '0.0.0.0:8084'
      # DOCKER_VERNEMQ_LISTENER__MQTTS__CAFILE: '/etc/letsencrypt/live/bmms.yourdomain.com/fullchain.pem'
      # DOCKER_VERNEMQ_LISTENER__MQTTS__CERTFILE: '/etc/letsencrypt/live/bmms.yourdomain.com/cert.pem'
      # DOCKER_VERNEMQ_LISTENER__MQTTS__KEYFILE: '/etc/letsencrypt/live/bmms.yourdomain.com/privkey.pem'
      
      # ===== Log =====
      DOCKER_VERNEMQ_LOG__CONSOLE__LEVEL: 'info'
      DOCKER_VERNEMQ_LOG__CONSOLE__FILE: '/vernemq/log/vernemq.log'
      
      # ===== 效能設定 =====
      DOCKER_VERNEMQ_MAX_CLIENT_ID_SIZE: '100'
      DOCKER_VERNEMQ_MAX_OFFLINE_MESSAGES: '10000'
      DOCKER_VERNEMQ_MAX_ONLINE_MESSAGES: '10000'
      DOCKER_VERNEMQ_MAX_CONNECTIONS: '50000'
      
      # ===== 持久化 =====
      DOCKER_VERNEMQ_PERSISTENCE: 'on'
      DOCKER_VERNEMQ_PERSISTENCE_DIR: '/vernemq/data'
      
    ports:
      - "1883:1883"    # MQTT TCP
      - "8083:8083"    # MQTT WebSocket
      # - "8883:8883"  # MQTTS (需要 SSL)
      # - "8084:8084"  # MQTT WSS (需要 SSL)
      - "8888:8888"    # HTTP API (管理用)
      
    volumes:
      # SSL 憑證 (如果有)
      - /etc/letsencrypt:/etc/letsencrypt:ro
      
      # 持久化數據
      - ./data:/vernemq/data
      - ./log:/vernemq/log
      
    restart: always
    
    healthcheck:
      test: ["CMD", "vernemq", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  vernemq_data:
  vernemq_log:
```

**啟動服務：**

```bash
# 建立目錄
mkdir -p data log

# 啟動
docker-compose up -d

# 查看日誌
docker-compose logs -f

# 驗證
docker-compose exec vernemq vernemq ping
```

### 選項 2: 使用 Systemd Service（原生安裝）

如果不想用 Docker：

```bash
# Ubuntu/Debian
curl -L https://github.com/vernemq/vernemq/releases/download/1.13.0/vernemq-1.13.0.focal.tar.gz -o vernemq.tar.gz
tar -xzf vernemq.tar.gz -C /opt
cd /opt/vernemq

# 啟動
./bin/vernemq start

# 設定開機自動啟動
systemctl enable vernemq
systemctl start vernemq
```

### 選項 3: 使用 Mosquitto（輕量級替代方案）

```yaml
# /opt/mqtt-broker/docker-compose.yml

version: '3.8'

services:
  mosquitto:
    image: eclipse-mosquitto:2
    container_name: mqtt_broker
    restart: always
    ports:
      - "1883:1883"
      - "9001:9001"  # WebSocket
    volumes:
      - ./mosquitto/config:/mosquitto/config
      - ./mosquitto/data:/mosquitto/data
      - ./mosquitto/log:/mosquitto/log
    healthcheck:
      test: ["CMD-SHELL", "mosquitto_sub -t '$$SYS/#' -C 1 | grep -v Error || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
```

**mosquitto.conf:**

```conf
# mosquitto/config/mosquitto.conf

# 監聽設定
listener 1883
protocol mqtt

listener 9001
protocol websockets

# 允許匿名 (開發環境)
allow_anonymous true

# 持久化
persistence true
persistence_location /mosquitto/data/

# Log
log_dest file /mosquitto/log/mosquitto.log
log_type all
```

---

## 🔒 生產環境安全設定

### 1. 啟用身份驗證

**VerneMQ:**

```bash
# 進入容器
docker exec -it mqtt_broker sh

# 建立使用者
vmq-passwd /etc/vernemq/vmq.passwd your_username
# 輸入密碼

# 更新 docker-compose.yml
environment:
  DOCKER_VERNEMQ_ALLOW_ANONYMOUS: 'off'
  DOCKER_VERNEMQ_PLUGINS__VMQ_PASSWD: 'on'

# 重啟
docker-compose restart
```

**Mosquitto:**

```bash
# 建立密碼檔
docker exec -it mqtt_broker mosquitto_passwd -c /mosquitto/config/passwd your_username

# 更新 mosquitto.conf
allow_anonymous false
password_file /mosquitto/config/passwd
```

### 2. 啟用 SSL/TLS

需要有 Let's Encrypt 憑證：

```bash
# 確保有憑證
ls /etc/letsencrypt/live/bmms.yourdomain.com/
```

更新 docker-compose.yml 啟用 MQTTS (8883) 和 WSS (8084)。

### 3. 設定防火牆

```bash
# Ubuntu/Debian
sudo ufw allow 1883/tcp    # MQTT
sudo ufw allow 8083/tcp    # WebSocket
sudo ufw allow 8883/tcp    # MQTTS
sudo ufw allow 8084/tcp    # WSS
sudo ufw reload
```

---

## ✅ 驗證步驟

### 1. 測試 MQTT 連線

```bash
# 訂閱
mosquitto_sub -h your-server-ip -p 1883 -t "test/#" -v

# 發布
mosquitto_pub -h your-server-ip -p 1883 -t "test/hello" -m "Hello MQTT"
```

### 2. 測試 WebSocket 連線

使用 MQTT.fx 或 MQTTX 工具：
- Protocol: WebSocket
- Host: ws://your-server-ip:8083

### 3. 檢查 Django 能否連線

```python
# backend/test_mqtt.py

import paho.mqtt.client as mqtt

def on_connect(client, userdata, flags, rc):
    print(f"Connected with result code {rc}")
    client.subscribe("test/#")

def on_message(client, userdata, msg):
    print(f"Received: {msg.topic} {msg.payload}")

client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message

# 使用環境變數中的 MQTT_BROKER_HOST
client.connect("your-server-ip", 1883, 60)
client.loop_forever()
```

```bash
python backend/test_mqtt.py
```

---

## 📊 監控與管理

### VerneMQ HTTP API

```bash
# 查看所有連線的 clients
curl http://your-server-ip:8888/api/v1/session/show

# 查看訂閱
curl http://your-server-ip:8888/api/v1/subscription/show

# 斷開特定 client
curl -X DELETE http://your-server-ip:8888/api/v1/session/disconnect/client_id
```

### Mosquitto 監控

```bash
# 查看系統主題
mosquitto_sub -h localhost -p 1883 -t '$SYS/#' -v

# 查看連線數
mosquitto_sub -h localhost -p 1883 -t '$SYS/broker/clients/connected'
```

---

## 🎯 最終架構圖

```
┌─────────────────────────────────────────────────────┐
│                   Server (實體機器)                  │
│                                                       │
│  ┌──────────────────────────────────────────────┐  │
│  │           MQTT Broker (VerneMQ)              │  │
│  │   Port: 1883 (MQTT)                          │  │
│  │   Port: 8083 (WebSocket)                     │  │
│  │   Port: 8883 (MQTTS)                         │  │
│  └──────────────────────────────────────────────┘  │
│                      ↑                               │
│                      │                               │
│  ┌───────────────────┼────────────────────────────┐│
│  │  專案 A (docker-compose)                       ││
│  │    ├── Django Backend ─────┘                   ││
│  │    ├── Angular Frontend ───┘                   ││
│  │    ├── PostgreSQL                              ││
│  │    └── Redis                                   ││
│  └─────────────────────────────────────────────────┘│
│                                                       │
│  ┌─────────────────────────────────────────────────┐│
│  │  專案 B (docker-compose)                       ││
│  │    ├── Django Backend ─────┐                   ││
│  │    ├── Angular Frontend ───┤                   ││
│  │    └── PostgreSQL           │                   ││
│  └─────────────────────────────┼───────────────────┘│
│                                 │                     │
└─────────────────────────────────┼─────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
              ┌─────┴─────┐             ┌──────┴──────┐
              │  ESP32    │             │   Mobile    │
              │  感測器    │             │     App     │
              └───────────┘             └─────────────┘
```

---

## 📝 檢查清單

完成以下項目以確保移除成功：

### Docker Compose
- [ ] 從 `docker-compose.yml` 移除 `vernemq` 服務定義
- [ ] 從 `volumes` 移除 `vernemq_data` 和 `vernemq_log`
- [ ] 從 `backend.depends_on` 移除 `vernemq`
- [ ] 更新 `backend.environment` 中的 `MQTT_BROKER_HOST`

### 本地檔案
- [ ] 刪除 `vernemq/` 目錄

### 環境變數
- [ ] 更新 `.env` 中的 `MQTT_BROKER_HOST`
- [ ] 更新前端 `environment.ts` 中的 `mqttBrokerHost`
- [ ] 更新前端 `environment.prod.ts` 中的 `mqttBrokerHost`

### Server 設定
- [ ] 在 server 上部署獨立的 MQTT Broker
- [ ] 開啟防火牆 ports (1883, 8083, 8883, 8084)
- [ ] 設定 SSL/TLS（如果需要）
- [ ] 設定身份驗證（生產環境）

### 測試
- [ ] 使用 `mosquitto_sub/pub` 測試 MQTT 連線
- [ ] 測試 Django backend 能否連線
- [ ] 測試前端 WebSocket 連線
- [ ] 測試外部設備連線

---

## 🚨 常見問題

### Q1: 開發環境如何測試？

**A:** 開發時可以在本機跑一個 MQTT Broker：

```bash
# 臨時啟動 Mosquitto
docker run -d -p 1883:1883 -p 9001:9001 eclipse-mosquitto:2

# 環境變數設為 localhost
MQTT_BROKER_HOST=localhost
```

### Q2: 如何處理多專案的 Topic 隔離？

**A:** 使用 Topic 命名規範：

```
project_a/sensors/temperature/room_101
project_b/sensors/humidity/office_203

# ACL 規則
project_a/* -> 只有 project_a 的 clients 可以訂閱
project_b/* -> 只有 project_b 的 clients 可以訂閱
```

### Q3: 需要高可用怎麼辦？

**A:** 部署 VerneMQ Cluster：

```yaml
# Node 1
DOCKER_VERNEMQ_DISCOVERY_NODE=node2@vernemq2

# Node 2
DOCKER_VERNEMQ_DISCOVERY_NODE=node1@vernemq1
```

但對於一般專案，單節點已經足夠。

---

## 📚 相關文件

- [VerneMQ Documentation](https://docs.vernemq.com/)
- [Mosquitto Documentation](https://mosquitto.org/documentation/)
- [MQTT Protocol](https://mqtt.org/)
- [Paho MQTT Python](https://www.eclipse.org/paho/index.php?page=clients/python/index.php)

---

**最後更新**: 2025-12-11  
**適用專案**: tx_bmms  
**文件目的**: 指導 Claude Code 完成架構重構

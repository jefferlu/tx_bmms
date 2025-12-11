# tx_bmms IoT Integration - Development Progress Report

**專案**: BMMS (Building Model Management System) IoT 整合
**開始日期**: 2025-12-11
**最後更新**: 2025-12-11

---

## 📊 整體進度

- [x] **Phase 0**: Docker 環境設定 ✅ **已完成**
- [ ] **Phase 1**: 資料庫設計與 Backend 基礎架構
- [ ] **Phase 2**: Backend MQTT 整合
- [ ] **Phase 3**: Frontend 基礎架構
- [ ] **Phase 4**: Forge Viewer IoT 整合
- [ ] **Phase 5**: 即時數據處理
- [ ] **Phase 6**: 進階功能
- [ ] **Phase 7**: 測試與優化

---

## ✅ Phase 0: Docker 環境設定 (已完成)

### 完成日期
2025-12-11

### 完成項目

#### 1. 更新 docker-compose.yml

**新增服務:**
- ✅ VerneMQ MQTT Broker
  - Image: `vernemq/vernemq:latest`
  - Container: `bmms_vernemq`
  - Ports:
    - `1883`: MQTT TCP (標準協議)
    - `8083`: MQTT WebSocket (瀏覽器連線)
  - 持久化: `vernemq_data`, `vernemq_log`
  - 健康檢查: 已配置

**增強服務:**
- ✅ Redis
  - 升級至: `redis:7-alpine`
  - 新增持久化: `redis_data` volume
  - 新增健康檢查
  - 啟用 AOF 持久化模式

**更新環境變數:**
- ✅ Backend 服務
  - 新增 MQTT 相關環境變數 (MQTT_BROKER_HOST, PORT, etc.)
  - 新增 Redis 相關環境變數
  - 新增 Sensor Data 設定

- ✅ Celery 服務
  - 新增 MQTT 和 Redis 環境變數
  - 新增 vernemq 依賴

**新增 Volumes:**
- ✅ `redis_data`: Redis 持久化數據
- ✅ `vernemq_data`: VerneMQ 持久化數據
- ✅ `vernemq_log`: VerneMQ 日誌

#### 2. 建立目錄結構

```bash
✅ vernemq/
   ├── log/      # VerneMQ 日誌目錄
   └── data/     # VerneMQ 持久化數據

✅ redis/
   └── data/     # Redis AOF 持久化文件
```

### 修改的文件清單

| 文件 | 狀態 | 說明 |
|------|------|------|
| `docker-compose.yml` | ✅ 已修改 | 新增 VerneMQ 服務，增強 Redis，更新環境變數 |
| `vernemq/log/` | ✅ 已創建 | VerneMQ 日誌目錄 |
| `vernemq/data/` | ✅ 已創建 | VerneMQ 數據目錄 |
| `redis/data/` | ✅ 已創建 | Redis 數據目錄 |

### 詳細變更說明

#### docker-compose.yml 變更內容

**Backend 服務新增環境變數:**
```yaml
# MQTT Settings
- MQTT_BROKER_HOST=vernemq
- MQTT_BROKER_PORT=1883
- MQTT_BROKER_WS_PORT=8083
- MQTT_BROKER_USERNAME=
- MQTT_BROKER_PASSWORD=
- MQTT_KEEPALIVE=60
- MQTT_CLIENT_ID_PREFIX=tx_bmms

# Redis Settings
- REDIS_HOST=redis
- REDIS_PORT=6379
- REDIS_DB=0
- REDIS_PASSWORD=

# Sensor Data Settings
- SENSOR_DATA_SAVE_TO_DB=False
- SENSOR_DATA_RETENTION_HOURS=168
```

**VerneMQ 服務配置:**
```yaml
vernemq:
    image: vernemq/vernemq:latest
    container_name: bmms_vernemq
    restart: always
    hostname: vernemq
    environment:
        - DOCKER_VERNEMQ_ACCEPT_EULA=yes
        - DOCKER_VERNEMQ_ALLOW_ANONYMOUS=on
        - DOCKER_VERNEMQ_LISTENER__TCP__DEFAULT=0.0.0.0:1883
        - DOCKER_VERNEMQ_LISTENER__WS__DEFAULT=0.0.0.0:8083
        - DOCKER_VERNEMQ_LOG__CONSOLE__LEVEL=info
        - DOCKER_VERNEMQ_MAX_CLIENT_ID_SIZE=100
        - DOCKER_VERNEMQ_PERSISTENCE=on
    ports:
        - "1883:1883"  # MQTT TCP
        - "8083:8083"  # MQTT WebSocket
    volumes:
        - vernemq_log:/vernemq/log
        - vernemq_data:/vernemq/data
    healthcheck:
        test: ["CMD", "vernemq", "ping"]
        interval: 30s
        timeout: 10s
        retries: 3
```

**Redis 服務增強:**
```yaml
redis:
    image: redis:7-alpine  # 從 redis:latest 升級
    command: redis-server --appendonly yes  # 啟用 AOF
    volumes:
        - redis_data:/data  # 新增持久化
    healthcheck:  # 新增健康檢查
        test: ["CMD", "redis-cli", "ping"]
        interval: 10s
        timeout: 3s
        retries: 3
```

### 下一步驟

**Phase 0 剩餘任務:**
- [ ] 啟動 Docker 服務
- [ ] 驗證 VerneMQ 連線
- [ ] 驗證 Redis 連線
- [ ] 測試 MQTT 發布/訂閱

**準備進入 Phase 1:**
- [ ] 建立 Django `sensors` app
- [ ] 設計資料庫 Models
- [ ] 執行 migrations

---

## 📝 Phase 1: 資料庫設計與 Backend 基礎架構 (進行中)

_尚未開始_

---

## 🔧 技術筆記

### VerneMQ 配置說明

**開發環境設定:**
- 允許匿名連線 (`ALLOW_ANONYMOUS=on`)
- 不需要 SSL/TLS 憑證
- 使用標準端口 1883 (MQTT) 和 8083 (WebSocket)

**生產環境建議:**
- 設定 `ALLOW_ANONYMOUS=off`
- 啟用身份驗證
- 配置 SSL/TLS (port 8084 for WSS)
- 限制連線數和訊息隊列大小

### Redis 配置說明

**AOF 持久化:**
- 使用 `--appendonly yes` 啟用
- 每秒同步一次 (默認)
- 數據安全性較高，但效能略低於 RDB

**健康檢查:**
- 每 10 秒檢查一次
- 3 秒超時
- 3 次重試後標記為 unhealthy

---

## 📌 重要提醒

1. **Port 衝突檢查**: 確認 port 1883, 8083, 6379 未被佔用
2. **Volume 權限**: 確保 Docker 有權限訪問 vernemq/ 和 redis/ 目錄
3. **內存配置**: VerneMQ 和 Redis 可能需要較多內存，建議至少 2GB 可用內存
4. **網絡配置**: 所有服務都在 `internal_network` 中，確保網絡配置正確

---

## 🐛 已知問題

_目前無已知問題_

---

## 📚 參考資源

- [VerneMQ 官方文檔](https://docs.vernemq.com/)
- [Redis 官方文檔](https://redis.io/documentation)
- [MQTT 協議規範](https://mqtt.org/)
- [Docker Compose 文檔](https://docs.docker.com/compose/)

---

**最後更新者**: Claude
**下次更新**: Phase 0 驗證完成後

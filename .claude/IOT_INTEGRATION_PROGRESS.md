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

**架構調整:**
- ✅ 使用外部 MQTT Broker (`giantcld.com:1883`)
- ✅ 移除本地 VerneMQ 容器
- ✅ 簡化 Docker 服務依賴

**增強服務:**
- ✅ Redis
  - 升級至: `redis:7-alpine`
  - 新增持久化: `redis_data` volume
  - 新增健康檢查
  - 啟用 AOF 持久化模式

**更新環境變數:**
- ✅ Backend 服務
  - MQTT_BROKER_HOST: `giantcld.com` (外部 MQTT 服務)
  - MQTT_BROKER_PORT: `1883`
  - MQTT_BROKER_WS_PORT: `8083`
  - 新增 Redis 相關環境變數
  - 新增 Sensor Data 設定

- ✅ Celery 服務
  - MQTT_BROKER_HOST: `giantcld.com`
  - MQTT_BROKER_PORT: `1883`
  - 新增 Redis 環境變數

**新增 Volumes:**
- ✅ `redis_data`: Redis 持久化數據

#### 2. 建立目錄結構

```bash
✅ redis/
   └── data/     # Redis AOF 持久化文件
```

### 修改的文件清單

| 文件 | 狀態 | 說明 |
|------|------|------|
| `docker-compose.yml` | ✅ 已修改 | 移除本地 VerneMQ，配置外部 MQTT，增強 Redis |
| `backend/tx_bmms/settings.py` | ✅ 已修改 | 更新 MQTT_BROKER_HOST 為 giantcld.com |
| `redis/data/` | ✅ 已創建 | Redis 數據目錄 |

### 詳細變更說明

#### docker-compose.yml 變更內容

**Backend 服務環境變數 (使用外部 MQTT):**
```yaml
# MQTT Settings (使用外部 MQTT Broker)
- MQTT_BROKER_HOST=giantcld.com
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

**移除的服務依賴:**
```yaml
# Backend 和 Celery 不再依賴本地 vernemq
depends_on:
    - postgres
    - redis
    # - vernemq  # 已移除
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

### 架構調整：使用外部 MQTT Broker (2025-12-11)

**變更說明**：
專案改用現有的外部 MQTT Broker 服務，不再在 docker-compose 中啟動本地 VerneMQ 容器。

**外部 MQTT Broker 資訊**：
- Host: `giantcld.com`
- Port: `1883` (MQTT TCP)
- WebSocket Port: `8083`
- 匿名連線: 已啟用

**移除的配置**：
1. ✅ docker-compose.yml 中的 `vernemq` 服務
2. ✅ volumes 中的 `vernemq_data` 和 `vernemq_log`
3. ✅ backend 和 celery 的 `depends_on: vernemq`
4. ✅ 本地 vernemq 目錄 (vernemq/log, vernemq/data)

**更新的配置**：
1. ✅ Backend 環境變數 `MQTT_BROKER_HOST: giantcld.com`
2. ✅ Celery 環境變數 `MQTT_BROKER_HOST: giantcld.com`
3. ✅ Django settings.py 默認值改為 `giantcld.com`

**優點**：
- ✅ 簡化專案架構
- ✅ 減少 Docker 容器數量
- ✅ 使用穩定的生產環境 MQTT 服務
- ✅ 避免本地 VerneMQ 配置問題

### 下一步驟

**Phase 0 狀態:**
- ✅ Docker 環境設定完成
- ✅ Redis 服務配置完成
- ✅ 外部 MQTT Broker 配置完成
- [ ] (可選) 測試外部 MQTT 連線

**測試外部 MQTT 連線 (可選):**
```bash
# 使用 mosquitto_pub/sub 測試
mosquitto_sub -h giantcld.com -p 1883 -t "test/topic" -v
mosquitto_pub -h giantcld.com -p 1883 -t "test/topic" -m "Hello MQTT"
```

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

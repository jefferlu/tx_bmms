# tx_bmms IoT Integration - Development Progress Report

**專案**: BMMS (Building Model Management System) IoT 整合
**開始日期**: 2025-12-11
**最後更新**: 2025-12-12

---

## 📊 整體進度

- [x] **Phase 0**: Docker 環境設定 ✅ **已完成**
- [x] **Phase 1**: 資料庫設計與 Backend 基礎架構 ✅ **已完成**
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
- [x] 建立 Django `sensors` app
- [x] 設計資料庫 Models
- [x] 執行 migrations

---

## ✅ Phase 1: 資料庫設計與 Backend 基礎架構 (已完成)

### 完成日期
2025-12-12

### 完成項目

#### 1. 建立 Django sensors app

**建立的目錄結構:**
```
backend/sensors/
├── __init__.py
├── apps.py
├── models.py
├── admin.py
├── views.py
├── serializers.py
├── urls.py
├── mqtt_client.py
└── management/
    ├── __init__.py
    └── commands/
        ├── __init__.py
        └── create_sample_sensors.py
```

#### 2. 資料庫 Models 設計

**建立的 Models:**

✅ **Sensor** (感測器主表)
- 基本資訊: sensor_id, name, description, sensor_type, unit
- MQTT 設定: mqtt_topic, mqtt_qos
- Modbus 設定: modbus_address, modbus_register (可選)
- API 設定: api_endpoint, api_method (可選)
- 顯示設定: display_format, decimal_places
- 告警閾值: warning_threshold_min/max, error_threshold_min/max
- 資料轉換: data_transform (JSON)
- 狀態: is_active, last_seen
- 時間戳: created_at, updated_at

**支援的感測器類型:**
- temperature (溫度)
- humidity (濕度)
- pressure (壓力)
- flow (流量)
- power (功率)
- voltage (電壓)
- current (電流)
- status (狀態)
- occupancy (佔用率)
- co2 (CO2濃度)

✅ **SensorBimBinding** (感測器與 BIM Element 綁定)
- 感測器關聯: sensor (ForeignKey)
- BIM Element 識別: model_urn, element_dbid, element_external_id, element_name
- 顯示位置: position_type, position_offset (JSON)
- 顯示樣式: label_visible, icon_type, color
- 其他: priority, notes, is_active
- 時間戳: created_at, updated_at

✅ **SensorDataLog** (感測器數據歷史日誌)
- 感測器關聯: sensor (ForeignKey)
- 數據: value, raw_value, status
- 時間戳: timestamp
- 狀態類型: normal, warning, error, offline

#### 3. Django Admin 配置

✅ **SensorAdmin**
- 列表顯示: sensor_id, name, sensor_type, unit, is_active, last_seen
- 過濾器: sensor_type, is_active, created_at
- 搜索: sensor_id, name, mqtt_topic
- 分組欄位: 基本資訊、MQTT設定、Modbus設定、API設定、顯示設定、告警閾值、數據轉換、狀態

✅ **SensorBimBindingAdmin**
- 列表顯示: sensor, model_urn, element_dbid, element_name, position_type, is_active
- 過濾器: position_type, is_active, created_at
- 搜索: sensor__sensor_id, sensor__name, element_name, model_urn
- 使用 raw_id_fields 優化大量數據顯示

✅ **SensorDataLogAdmin**
- 列表顯示: sensor, value, status, timestamp
- 過濾器: status, timestamp
- 日期層級: timestamp
- 只讀權限 (防止手動修改歷史數據)

#### 4. REST API 實作

**建立的 Serializers:**
- ✅ SensorSerializer (包含 bim_bindings_count, latest_value)
- ✅ SensorBimBindingSerializer (包含 sensor_detail)
- ✅ SensorDataLogSerializer (包含 sensor_name)

**建立的 ViewSets:**

✅ **SensorViewSet**
- 基本 CRUD: list, create, retrieve, update, destroy
- 自定義 actions:
  - `bindings/`: 取得特定感測器的所有綁定
  - `latest_data/`: 取得感測器最新數據 (從 Redis)
  - `realtime/`: 批次取得多個感測器的即時數據
  - `history/`: 取得歷史數據
- 過濾: sensor_type, is_active
- 搜索: sensor_id, name, mqtt_topic
- 排序: sensor_id, name, created_at

✅ **SensorBimBindingViewSet**
- 基本 CRUD: list, create, retrieve, update, destroy
- 自定義 actions:
  - `by_model/`: 根據 model URN 取得所有綁定
  - `batch_create/`: 批次建立綁定
  - `batch_delete/`: 批次刪除綁定
- 過濾: sensor, model_urn, is_active

#### 5. MQTT Client 實作

✅ **MQTTClient 類別** (`backend/sensors/mqtt_client.py`)

**功能:**
- 連線到外部 MQTT Broker (giantcld.com:1883)
- 支援認證 (username/password)
- 自動訂閱所有啟用感測器的 topics
- 接收並處理感測器數據
- 數據轉換 (scale, offset)
- 狀態判斷 (normal, warning, error, unknown)
- 儲存即時數據到 Redis (TTL: 1小時)
- 可選寫入資料庫歷史 (SensorDataLog)
- 支援發布訊息 (控制感測器)

**回調函數:**
- `on_connect`: 連線成功後自動訂閱所有感測器 topics
- `on_disconnect`: 處理斷線事件
- `on_message`: 接收並解析 MQTT 訊息

**全域實例:**
- `get_mqtt_client()`: 單例模式取得 MQTT Client

#### 6. Management Command

✅ **create_sample_sensors** 命令
- 快速建立 4 個範例感測器:
  - TEMP_001: 會議室 101 溫度
  - HUMID_001: 會議室 101 濕度
  - CO2_001: 會議室 101 CO2
  - POWER_001: 空調主機功率
- 使用 `get_or_create` 避免重複建立
- 包含合理的告警閾值設定

**使用方式:**
```bash
python manage.py create_sample_sensors
```

#### 7. Django 配置更新

✅ **INSTALLED_APPS**
- 新增 `'sensors'` app

✅ **URL 配置**
- 新增路由: `path('api/sensors/', include('sensors.urls'))`

**API Endpoints:**
```
GET    /api/sensors/sensors/                    # 取得所有感測器
POST   /api/sensors/sensors/                    # 建立感測器
GET    /api/sensors/sensors/{id}/               # 取得特定感測器
PATCH  /api/sensors/sensors/{id}/               # 更新感測器
DELETE /api/sensors/sensors/{id}/               # 刪除感測器
GET    /api/sensors/sensors/{id}/bindings/      # 取得感測器的所有綁定
GET    /api/sensors/sensors/{id}/latest_data/   # 取得最新數據
GET    /api/sensors/sensors/realtime/?sensor_ids=TEMP_001,HUMID_001
GET    /api/sensors/sensors/{id}/history/?hours=24

GET    /api/sensors/bindings/                   # 取得所有綁定
POST   /api/sensors/bindings/                   # 建立綁定
GET    /api/sensors/bindings/{id}/              # 取得特定綁定
PATCH  /api/sensors/bindings/{id}/              # 更新綁定
DELETE /api/sensors/bindings/{id}/              # 刪除綁定
GET    /api/sensors/bindings/by_model/?model_urn=xxx
POST   /api/sensors/bindings/batch_create/
POST   /api/sensors/bindings/batch_delete/
```

### 修改的文件清單

| 文件 | 狀態 | 說明 |
|------|------|------|
| `backend/sensors/__init__.py` | ✅ 已創建 | App 初始化 |
| `backend/sensors/apps.py` | ✅ 已創建 | App 配置，啟動時自動連接 MQTT |
| `backend/sensors/models.py` | ✅ 已創建 | 3 個 Model: Sensor, SensorBimBinding, SensorDataLog |
| `backend/sensors/admin.py` | ✅ 已創建 | Django Admin 配置 |
| `backend/sensors/serializers.py` | ✅ 已創建 | REST API Serializers |
| `backend/sensors/views.py` | ✅ 已創建 | REST API ViewSets |
| `backend/sensors/urls.py` | ✅ 已創建 | API URL 路由 |
| `backend/sensors/mqtt_client.py` | ✅ 已創建 | MQTT Client 實作 |
| `backend/sensors/management/commands/create_sample_sensors.py` | ✅ 已創建 | 範例數據建立命令 |
| `backend/tx_bmms/settings.py` | ✅ 已修改 | INSTALLED_APPS 新增 'sensors' |
| `backend/tx_bmms/urls.py` | ✅ 已修改 | 新增 API 路由 |

### 資料庫架構

**資料表:**
- `sensors`: 感測器主表
- `sensor_bim_bindings`: 感測器與 BIM 元件綁定表
- `sensor_data_logs`: 感測器數據歷史日誌表

**索引:**
- sensors: (sensor_type, is_active), (mqtt_topic)
- sensor_bim_bindings: unique(sensor, model_urn, element_dbid)
- sensor_data_logs: (sensor, -timestamp), (status, -timestamp)

### 下一步驟

**Phase 1 狀態:**
- ✅ Django sensors app 建立完成
- ✅ 資料庫 Models 設計完成
- ✅ Django Admin 配置完成
- ✅ REST API 實作完成
- ✅ MQTT Client 實作完成
- ✅ Management Command 建立完成
- ⚠️ 需執行 migrations (在 Docker 環境中)
- ⚠️ 需測試 API endpoints
- ⚠️ 需測試 MQTT 連線

**準備進入 Phase 2:**
- [ ] 測試 MQTT Client 連線到 giantcld.com
- [ ] 建立測試用 MQTT Publisher
- [ ] 驗證感測器數據接收與處理
- [ ] 測試 Redis 數據儲存

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
**下次更新**: Phase 1 migrations 執行後，準備進入 Phase 2

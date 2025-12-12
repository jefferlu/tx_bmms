# MQTT 調試指南

## 日誌級別說明

### 正常運行時的日誌級別

**INFO 級別** - 顯示重要事件：
- ✅ MQTT 連接成功/失敗
- ✅ 訂閱 topics 成功/失敗
- ✅ 應用啟動/關閉

**WARNING 級別** - 顯示異常但可恢復的情況：
- ⚠️ 找不到對應的感測器
- ⚠️ 無法解析的訊息格式
- ⚠️ 意外斷線

**ERROR 級別** - 顯示嚴重錯誤：
- ❌ 連接失敗
- ❌ 數據處理異常

**DEBUG 級別** - 顯示詳細的調試信息（預設關閉）：
- 🔍 接收到的每一條 MQTT 訊息
- 🔍 處理的每一筆感測器數據

### 為什麼使用 DEBUG 級別？

**優點：**
- ✅ 不會產生大量日誌，節省磁盤空間
- ✅ 提高性能，減少 I/O 操作
- ✅ 讓重要日誌更容易找到

**缺點：**
- ❌ 正常情況下看不到數據接收的詳細信息

## 如何啟用 DEBUG 日誌

### 方法 1: 臨時啟用（推薦用於調試）

**修改 Django settings.py 的 LOGGING 配置：**

```python
# backend/tx_bmms/settings.py

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',  # 預設為 INFO
    },
    'loggers': {
        'apps.sensors.mqtt_client': {
            'handlers': ['console'],
            'level': 'DEBUG',  # 只針對 MQTT Client 啟用 DEBUG
            'propagate': False,
        },
    },
}
```

**重啟容器：**
```bash
docker compose restart backend
```

### 方法 2: 使用環境變數

**修改 docker-compose.yml：**

```yaml
backend:
  environment:
    - DJANGO_LOG_LEVEL=DEBUG  # 全局啟用 DEBUG
```

**然後在 settings.py 中使用：**

```python
LOGGING = {
    'root': {
        'handlers': ['console'],
        'level': os.getenv('DJANGO_LOG_LEVEL', 'INFO'),
    },
}
```

### 方法 3: 只在特定時間啟用（最靈活）

**進入容器執行 Django shell：**

```bash
docker compose exec backend python manage.py shell
```

**動態修改日誌級別：**

```python
import logging

# 啟用 DEBUG
logger = logging.getLogger('apps.sensors.mqtt_client')
logger.setLevel(logging.DEBUG)

# 關閉 DEBUG（改回 INFO）
logger.setLevel(logging.INFO)
```

**不需要重啟容器！**

## 驗證 MQTT 數據流

### 不使用 DEBUG 日誌的驗證方法

#### 1. 檢查 MQTT 連接狀態

```bash
docker compose logs backend | grep "Connected to MQTT Broker"
```

**預期輸出：**
```
backend_1  | Connected to MQTT Broker successfully
backend_1  | Subscribed to topic: sensors/temperature/room_101
backend_1  | Subscribed to topic: sensors/humidity/room_101
backend_1  | Subscribed to topic: sensors/co2/room_101
backend_1  | Subscribed to topic: sensors/power/hvac_main
```

#### 2. 檢查 Redis 數據（最佳方式）

```bash
# 進入 Redis
docker compose exec redis redis-cli

# 查看所有感測器 keys
> KEYS sensor:*
1) "sensor:TEMP_001:latest"
2) "sensor:HUMID_001:latest"
3) "sensor:CO2_001:latest"
4) "sensor:POWER_001:latest"

# 查看具體數據
> GET sensor:TEMP_001:latest
"{\"sensor_id\": \"TEMP_001\", \"value\": 23.45, \"unit\": \"°C\", \"status\": \"normal\", \"timestamp\": \"2025-12-12T10:30:00.000000\"}"

# 監控數據更新
> MONITOR
```

#### 3. 檢查感測器最後連線時間

```bash
docker compose exec backend python manage.py shell
```

```python
from apps.sensors.models import Sensor

# 查看所有感測器的最後連線時間
for sensor in Sensor.objects.all():
    print(f"{sensor.sensor_id}: {sensor.last_seen}")
```

#### 4. 使用 REST API

```bash
# 查看即時數據
curl http://localhost:8100/api/sensors/sensors/realtime/?sensor_ids=TEMP_001,HUMID_001

# 查看特定感測器
curl http://localhost:8100/api/sensors/sensors/1/
```

### 只在需要時啟用 DEBUG

**場景 1：初次測試 MQTT 連接**
- ✅ 啟用 DEBUG 查看詳細的訊息接收情況

**場景 2：排查數據異常**
- ✅ 啟用 DEBUG 檢查原始訊息內容

**場景 3：正常運行**
- ❌ 不要啟用 DEBUG，使用 Redis / API 查看數據

## 最佳實踐

### 日誌級別選擇

```python
# ✅ 正確的日誌使用
logger.info("MQTT Client started successfully")      # 啟動事件
logger.info("Subscribed to topic: xxx")              # 訂閱成功
logger.warning("No active sensor found")             # 找不到感測器
logger.error("Failed to connect to MQTT Broker")     # 連接失敗
logger.debug("Received message on topic 'xxx'")      # 每條訊息（頻繁）
logger.debug("Processed data for sensor xxx")        # 每筆數據（頻繁）

# ❌ 錯誤的日誌使用
logger.info("Received message on topic 'xxx'")       # 太頻繁
logger.debug("MQTT Client started successfully")     # 太重要
```

### Docker 日誌管理

**限制日誌大小（docker-compose.yml）：**

```yaml
backend:
  logging:
    driver: "json-file"
    options:
      max-size: "10m"      # 單個日誌文件最大 10MB
      max-file: "3"        # 最多保留 3 個日誌文件
```

**查看日誌時過濾：**

```bash
# 只看重要日誌（INFO 及以上）
docker compose logs backend | grep -E "INFO|WARNING|ERROR"

# 只看 MQTT 相關
docker compose logs backend | grep MQTT

# 只看錯誤
docker compose logs backend | grep ERROR
```

## 故障排除

### 問題：啟用 DEBUG 後看不到日誌

**可能原因：**
- Django LOGGING 配置被其他設定覆蓋
- 日誌級別設定在錯誤的位置

**解決方案：**
```bash
# 檢查當前日誌級別
docker compose exec backend python manage.py shell

>>> import logging
>>> logger = logging.getLogger('apps.sensors.mqtt_client')
>>> print(logger.level)
>>> print(logger.handlers)
```

### 問題：DEBUG 日誌太多

**解決方案：**
```python
# 只針對特定 logger 啟用 DEBUG
LOGGING = {
    'loggers': {
        'apps.sensors.mqtt_client': {
            'level': 'DEBUG',
        },
        'apps.sensors.models': {
            'level': 'INFO',  # 其他保持 INFO
        },
    },
}
```

## 總結

**預設配置（生產環境）：**
- 🎯 使用 `logger.debug()` 記錄頻繁事件
- 🎯 使用 `logger.info()` 記錄重要事件
- 🎯 日誌級別設為 INFO
- 🎯 通過 Redis 和 API 驗證數據

**調試時（開發環境）：**
- 🔧 臨時啟用 DEBUG 級別
- 🔧 完成調試後改回 INFO
- 🔧 使用 `docker compose logs -f backend` 實時查看

**監控建議：**
- 📊 使用 Redis MONITOR 查看即時數據
- 📊 定期檢查 Sensor.last_seen 時間戳
- 📊 使用 REST API 查詢數據狀態
- 📊 設定告警監控重要的 WARNING 和 ERROR 日誌

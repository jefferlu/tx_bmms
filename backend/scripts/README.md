# MQTT 測試腳本

## mqtt_test_publisher.py

模擬感測器發送數據到 MQTT Broker 的測試工具。

### 功能

- 連接到外部 MQTT Broker (giantcld.com:1883)
- 模擬 4 個感測器發送數據：
  - `TEMP_001`: 溫度感測器 (20-26°C)
  - `HUMID_001`: 濕度感測器 (40-60%)
  - `CO2_001`: CO2濃度感測器 (400-1000ppm)
  - `POWER_001`: 功率感測器 (5-15kW)
- 每 5 秒發送一次隨機數據
- 數據格式符合 Django MQTT Client 的期望格式

### 使用方式

#### 方法1: 在 Docker 容器中執行（推薦）

```bash
# 進入 backend 容器
docker compose exec backend bash

# 執行測試發布器
python scripts/mqtt_test_publisher.py
```

#### 方法2: 本地執行（需要安裝 paho-mqtt）

```bash
# 安裝依賴
pip install paho-mqtt

# 執行測試發布器
cd backend
python scripts/mqtt_test_publisher.py
```

### 輸出範例

```
======================================================================
MQTT Test Publisher for tx_bmms IoT Sensors
======================================================================
Target Broker: giantcld.com:1883
Sensors: 4
----------------------------------------------------------------------
Connecting to giantcld.com:1883...
✓ Connected to MQTT Broker at giantcld.com:1883

======================================================================
Starting to publish sensor data... (Press Ctrl+C to stop)
======================================================================

--- Iteration 1 (2025-12-12 10:30:00) ---
  ✓ TEMP_001      →  23.45 °C    (topic: sensors/temperature/room_101)
  ✓ HUMID_001     →  52.30 %     (topic: sensors/humidity/room_101)
  ✓ CO2_001       → 780.50 ppm   (topic: sensors/co2/room_101)
  ✓ POWER_001     →  10.25 kW    (topic: sensors/power/hvac_main)

--- Iteration 2 (2025-12-12 10:30:05) ---
  ...
```

### 停止發布器

按 `Ctrl+C` 停止發布器

### 驗證數據接收

#### 1. 檢查 Django 日誌

```bash
docker compose logs -f backend
```

應該會看到類似以下的日誌：
```
backend_1  | Received message on topic 'sensors/temperature/room_101': {"value": 23.45, ...}
backend_1  | Processed data for sensor TEMP_001: 23.45 °C
```

#### 2. 檢查 Redis 數據

```bash
# 進入 Redis 容器
docker compose exec redis redis-cli

# 查看所有感測器 keys
KEYS sensor:*

# 查看特定感測器數據
GET sensor:TEMP_001:latest
```

#### 3. 使用 REST API 查詢

```bash
# 取得所有感測器
curl http://localhost:8100/api/sensors/sensors/

# 取得特定感測器的最新數據
curl http://localhost:8100/api/sensors/sensors/1/latest_data/

# 批次取得即時數據
curl "http://localhost:8100/api/sensors/sensors/realtime/?sensor_ids=TEMP_001,HUMID_001"
```

### 自定義設定

編輯 `mqtt_test_publisher.py` 可修改：

- **MQTT_BROKER**: MQTT Broker 地址（預設: giantcld.com）
- **MQTT_PORT**: MQTT 端口（預設: 1883）
- **SENSORS**: 感測器配置（sensor_id, topic, 數值範圍等）
- **time.sleep(5)**: 發送間隔（預設: 5秒）

### 故障排除

#### 連線失敗

```
✗ Failed to connect, return code 1
```

**可能原因**:
- MQTT Broker 無法訪問
- 防火牆阻擋 port 1883
- 網絡問題

**解決方案**:
```bash
# 測試 MQTT Broker 連通性
telnet giantcld.com 1883

# 或使用 mosquitto 測試
mosquitto_pub -h giantcld.com -p 1883 -t "test/topic" -m "test"
```

#### 發布失敗

```
✗ TEMP_001 → Failed to publish
```

**可能原因**:
- MQTT Broker 不允許匿名連線
- Topic 權限不足
- 連線已斷開

**解決方案**:
- 檢查 MQTT Broker 設定
- 確認連線狀態
- 檢查 Broker 日誌

### 相關文件

- [MQTT 協議規範](https://mqtt.org/)
- [Paho MQTT Python 文檔](https://www.eclipse.org/paho/index.php?page=clients/python/index.php)
- [tx_bmms IoT Integration Guide](../../.claude/tx_bmms_iot_integration_with_vernemq.md)

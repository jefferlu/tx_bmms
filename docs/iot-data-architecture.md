# IoT 數據架構說明

## 架構概覽

### 當前數據流向

```
感測器設備 → MQTT Broker → 後端服務 → Redis → 前端 (HTTP API 輪詢)
```

### 為什麼不直接在前端接收 MQTT？

## 1. 安全性考量 🔒

### 問題：憑證暴露
如果前端直接連接 MQTT Broker：

```javascript
// ❌ 不安全：憑證暴露在瀏覽器中
const client = mqtt.connect('mqtt://broker.example.com', {
    username: 'admin',          // 任何人都能看到
    password: 'super-secret',   // 完全暴露
    clientId: 'web-client'
});
```

**風險**：
- 用戶可以通過瀏覽器開發者工具查看所有憑證
- 惡意用戶可以使用這些憑證直接連接 MQTT Broker
- 可能發送惡意數據、訂閱不該看到的主題
- 難以撤銷或更新憑證（需要重新部署前端）

### 解決方案：後端代理
```python
# ✅ 安全：憑證保存在後端環境變數中
MQTT_BROKER = os.getenv('MQTT_BROKER')
MQTT_USERNAME = os.getenv('MQTT_USERNAME')
MQTT_PASSWORD = os.getenv('MQTT_PASSWORD')

# 前端只能透過認證過的 API 存取數據
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_sensor_latest_data(request, sensor_id):
    # 從 Redis 讀取，不直接暴露 MQTT
    data = redis_client.get(f'sensor:{sensor_id}:latest')
    return Response(data)
```

## 2. 連接管理 📊

### 問題：連接數限制
- **MQTT Broker 連接數有限**：例如 Mosquitto 預設限制 1024 個連接
- **每個前端用戶 = 1 個連接**：
  - 10 個用戶同時在線 = 10 個 MQTT 連接
  - 100 個用戶 = 100 個連接
  - 達到限制後，新用戶無法連接

### 解決方案：單一後端連接
```
前端用戶 1 ──┐
前端用戶 2 ──┤
前端用戶 3 ──┼──> 後端 (1 個 MQTT 連接) ──> MQTT Broker
    ...      │
前端用戶 N ──┘
```

**優勢**：
- 只需要 1 個 MQTT 連接，無論多少前端用戶
- 大幅降低 MQTT Broker 負載
- 連接更穩定（後端持續運行，前端可能頻繁刷新）

## 3. 數據處理與驗證 ✅

### 後端可以進行數據處理

```python
def handle_mqtt_message(topic, payload):
    try:
        # 1. 數據驗證
        data = json.loads(payload)
        if 'sensor_id' not in data or 'value' not in data:
            logger.error(f"Invalid data format: {payload}")
            return

        # 2. 數據轉換
        sensor_id = data['sensor_id']
        value = float(data['value'])  # 確保是數字

        # 3. 業務邏輯
        # 檢查是否超過閾值
        if value > THRESHOLD:
            send_alert(sensor_id, value)

        # 4. 存入 Redis 和資料庫
        redis_client.set(f'sensor:{sensor_id}:latest', json.dumps(data))
        SensorLog.objects.create(sensor_id=sensor_id, value=value)

    except Exception as e:
        logger.error(f"Error processing MQTT message: {e}")
```

**前端直接連接的問題**：
- 無法統一驗證數據格式
- 每個前端都要實現相同的業務邏輯
- 難以集中管理和更新邏輯

## 4. 數據持久化 💾

### MQTT vs Redis

| 特性 | MQTT | Redis |
|------|------|-------|
| 用途 | 消息傳遞 | 數據緩存/持久化 |
| 數據保留 | 短暫（QoS 0/1）或需要配置 | 可持久化到磁碟 |
| 歷史數據 | 不保存 | 可以保存最新值 |
| 查詢能力 | 無 | 支持豐富的數據結構和查詢 |

### Redis 的優勢

```python
# 可以查詢最新數據
latest = redis_client.get('sensor:123:latest')

# 可以存儲時間序列
redis_client.zadd('sensor:123:history', {
    json.dumps(data): timestamp
})

# 可以設置過期時間
redis_client.setex('sensor:123:latest', 3600, data)  # 1小時過期
```

## 5. 瀏覽器兼容性 🌐

### MQTT over WebSocket 的挑戰

```javascript
// 需要 MQTT Broker 支持 WebSocket
// 需要額外配置和依賴
const client = mqtt.connect('ws://broker.example.com:8083/mqtt', {
    // WebSocket 特定配置
    protocolId: 'MQTT',
    protocolVersion: 4,
    // ...
});

// 連接管理複雜
client.on('connect', () => { /* ... */ });
client.on('disconnect', () => { /* ... */ });
client.on('error', () => { /* ... */ });
client.on('reconnect', () => { /* ... */ });
```

### HTTP API 的優勢

```typescript
// 簡單、標準、無需額外依賴
this.sensorService.getSensorLatestData(sensorId).subscribe({
    next: (data) => {
        // 處理數據
    },
    error: (err) => {
        // 錯誤處理
    }
});
```

## 即時性分析 ⏱️

### 延遲比較

#### 方案 A：前端直接連接 MQTT
```
設備 → MQTT Broker → 前端 (WebSocket)
延遲：10-50ms
```

#### 方案 B：當前架構（Redis + HTTP 輪詢）
```
設備 → MQTT Broker → 後端 → Redis → 前端 (HTTP 輪詢 1秒)
延遲：100-1000ms
```

### 延遲分析

| 階段 | 延遲 | 說明 |
|------|------|------|
| 設備 → MQTT Broker | 10-30ms | 網路延遲 |
| MQTT Broker → 後端 | 5-10ms | 本地網路 |
| 後端處理 → Redis | 1-5ms | 本地處理 |
| 前端輪詢間隔 | 1000ms | 每秒輪詢一次 |
| **總延遲** | **1016-1045ms** | **約 1 秒** |

### 這個延遲可以接受嗎？

**對於 IoT 監控場景：✅ 可以接受**

1. **監控數據特性**：
   - 溫度、濕度、CO2 等環境數據變化緩慢
   - 1 秒的延遲不影響監控效果
   - 人類感知閾值約 100-200ms，但數據變化遠慢於此

2. **視覺更新**：
   - ECharts 每秒更新一次圖表
   - 過於頻繁的更新反而影響可讀性

3. **伺服器負載**：
   - 1 秒輪詢間隔平衡了即時性和伺服器負載

## 如何優化即時性？

### 方案 1：WebSocket 推送（推薦） 🚀

```python
# 後端：使用 Django Channels
from channels.generic.websocket import AsyncWebsocketConsumer

class SensorConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.sensor_id = self.scope['url_route']['kwargs']['sensor_id']
        await self.channel_layer.group_add(
            f'sensor_{self.sensor_id}',
            self.channel_name
        )
        await self.accept()

    async def sensor_update(self, event):
        # 推送數據到前端
        await self.send(text_data=json.dumps(event['data']))
```

```typescript
// 前端：WebSocket 連接
const ws = new WebSocket('ws://localhost:8000/ws/sensor/123/');
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    updateChart(data);  // 即時更新圖表
};
```

**優勢**：
- 延遲降低到 20-100ms
- 雙向通信
- 只在有新數據時推送

**挑戰**：
- 需要維護 WebSocket 連接
- 伺服器需要支持（Django Channels + Redis/RabbitMQ）
- 部署較複雜（需要 ASGI 伺服器）

### 方案 2：Server-Sent Events (SSE)

```python
# 後端：SSE 端點
def sensor_stream(request, sensor_id):
    def event_stream():
        pubsub = redis_client.pubsub()
        pubsub.subscribe(f'sensor:{sensor_id}')
        for message in pubsub.listen():
            if message['type'] == 'message':
                yield f"data: {message['data']}\n\n"

    return StreamingHttpResponse(
        event_stream(),
        content_type='text/event-stream'
    )
```

```typescript
// 前端：EventSource
const eventSource = new EventSource(`/api/sensors/${sensorId}/stream/`);
eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    updateChart(data);
};
```

**優勢**：
- 單向推送，適合 IoT 監控
- 比 WebSocket 簡單
- 自動重連

**限制**：
- 只能伺服器推送到客戶端（單向）
- 瀏覽器連接數限制（通常 6 個/域名）

### 方案 3：減少輪詢間隔（簡單但不推薦）

```typescript
// 從 1 秒改為 500ms
setInterval(() => {
    fetchSensorData();
}, 500);  // ⚠️ 伺服器負載加倍
```

**問題**：
- 伺服器負載大幅增加
- 延遲改善有限（500ms vs 1000ms）
- 浪費帶寬（大部分時間數據沒變化）

## 推薦架構演進路徑

### 階段 1：當前架構（已實現） ✅
```
MQTT → 後端 → Redis → 前端 (HTTP 輪詢 1秒)
```
- **延遲**：~1 秒
- **適用**：監控、儀表板
- **優勢**：簡單、穩定、易維護

### 階段 2：加入 WebSocket 推送（未來優化）
```
MQTT → 後端 → Redis → WebSocket → 前端
                    ↘ HTTP API (備用)
```
- **延遲**：~50ms
- **適用**：需要即時響應的場景
- **優勢**：即時性好，保留 HTTP 備用

### 階段 3：混合模式（最佳實踐）
```
重要感測器 → WebSocket (即時推送)
一般感測器 → HTTP 輪詢 (1-5秒)
歷史數據  → HTTP API (按需查詢)
```
- **延遲**：根據重要性調整
- **適用**：大型系統
- **優勢**：平衡即時性和資源消耗

## 總結

### 為什麼選擇 Redis + HTTP 輪詢？

1. ✅ **安全性**：不暴露 MQTT 憑證
2. ✅ **可擴展性**：支持大量前端用戶
3. ✅ **可維護性**：集中數據處理邏輯
4. ✅ **可靠性**：數據持久化，易於查詢
5. ✅ **簡單性**：標準 HTTP API，無需額外協議
6. ⚠️ **延遲**：約 1 秒延遲（對監控場景可接受）

### 何時需要優化？

考慮升級到 WebSocket 如果：
- 需要 < 100ms 的即時性（如報警系統）
- 數據變化頻繁（每秒多次）
- 需要雙向通信（前端控制設備）

對於當前的 **BIM IoT 監控系統**，1 秒的輪詢間隔是**最佳平衡點**。

## 參考資料

- [MQTT Protocol Specification](https://mqtt.org/mqtt-specification/)
- [Django Channels Documentation](https://channels.readthedocs.io/)
- [Server-Sent Events API](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Redis Pub/Sub](https://redis.io/topics/pubsub)

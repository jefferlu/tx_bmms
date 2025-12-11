# tx_bmms IoT Integration Development TODO List

## 專案概述
在現有的 BMMS (Building Model Management System) 中整合 IoT 即時監測功能，實現感測器數據與 BIM 元素的綁定顯示。

**技術棧**
- Backend: Django + PostgreSQL + Redis
- Frontend: Angular + TypeScript
- 3D Viewer: Autodesk Forge Viewer
- 即時通訊: MQTT / WebSocket

---

## Phase 1: 資料庫設計與 Backend 基礎架構

### 1.1 建立資料庫 Models
- [ ] 建立 Django app: `sensors`
  ```bash
  cd backend
  python manage.py startapp sensors
  ```

- [ ] 實作 `Sensor` Model
  - 欄位: sensor_id, name, sensor_type, unit, mqtt_topic, modbus_address, display_format, warning thresholds
  - 加入 Meta: db_table, indexes, ordering
  - 實作 `__str__` 方法

- [ ] 實作 `SensorBimBinding` Model
  - 欄位: sensor (FK), model_urn, element_dbid, element_external_id, position_type, position_offset
  - unique_together 約束
  - 建立適當的索引

- [ ] 實作 `SensorData` Model (可選，用於歷史數據)
  - 欄位: sensor (FK), value, status, timestamp
  - 時間序列索引優化
  - 考慮使用 TimeScaleDB 或保留在 Redis

- [ ] 建立並執行 migrations
  ```bash
  python manage.py makemigrations sensors
  python manage.py migrate
  ```

### 1.2 建立 Serializers
- [ ] `backend/sensors/serializers.py`
  - SensorSerializer (包含 bim_bindings_count, latest_value)
  - SensorBimBindingSerializer (nested sensor_detail)
  - SensorDataSerializer

### 1.3 實作 ViewSets 和 API Endpoints
- [ ] `backend/sensors/views.py`
  - SensorViewSet
    - 標準 CRUD operations
    - Custom action: `bindings` - 取得感測器的所有綁定
    - Custom action: `latest_data` - 取得最新數據
  - SensorBimBindingViewSet
    - 標準 CRUD operations
    - Custom action: `by_model` - 根據 model_urn 查詢
    - Custom action: `batch_create` - 批次建立綁定

- [ ] 設定 URL routing
  ```python
  # backend/sensors/urls.py
  router.register('sensors', SensorViewSet)
  router.register('bindings', SensorBimBindingViewSet)
  ```

- [ ] 將 sensors URLs 加入主 urls.py
  ```python
  # backend/backend/urls.py
  path('api/sensors/', include('sensors.urls')),
  ```

### 1.4 建立測試數據
- [ ] 建立 management command 或 fixture
  ```bash
  python manage.py create_sample_sensors
  ```
  - 建立 5-10 個範例感測器
  - 包含不同類型: temperature, humidity, pressure, flow

---

## Phase 2: Frontend 基礎架構

### 2.1 建立 Service 層
- [ ] `client/src/app/services/sensor.service.ts`
  - 定義 interfaces: Sensor, SensorBimBinding, SensorData
  - 實作所有 API 呼叫方法
  - 加入 error handling 和 retry logic

- [ ] 在 app.module.ts 註冊 service

### 2.2 建立感測器管理頁面
- [ ] 建立 module 和 routing
  ```bash
  cd client/src/app
  ng generate module pages/sensor-management --routing
  ng generate component pages/sensor-management
  ```

- [ ] 實作感測器列表元件
  - [ ] HTML template: table with CRUD buttons
  - [ ] Component logic: load, refresh, delete
  - [ ] 加入分頁功能
  - [ ] 加入搜尋/篩選功能

- [ ] 建立感測器表單元件 (新增/編輯)
  ```bash
  ng generate component pages/sensor-management/sensor-form
  ```
  - [ ] Reactive Form 實作
  - [ ] Validation rules
  - [ ] 下拉選單: sensor_type, unit

- [ ] 建立感測器綁定管理元件
  ```bash
  ng generate component pages/sensor-management/binding-manager
  ```
  - [ ] 顯示所有綁定關係
  - [ ] 批次刪除功能
  - [ ] 匯出/匯入功能 (JSON)

### 2.3 UI/UX 優化
- [ ] 加入 Angular Material 或其他 UI 框架
- [ ] 設計一致的按鈕、表單、對話框樣式
- [ ] 實作 loading indicators
- [ ] 實作 toast notifications (成功/錯誤訊息)

---

## Phase 3: Forge Viewer IoT 整合

### 3.1 擴充現有的 aps-viewer 元件
- [ ] `client/src/app/layout/common/aps-viewer/aps-viewer.component.ts`
  - [ ] 加入 Input 參數
    - `@Input() enableIot: boolean = false`
    - `@Input() iotUpdateInterval: number = 5000`
  - [ ] 注入 SensorService
  - [ ] 實作生命週期管理 (destroy$ Subject)

### 3.2 實作 IoT Markup Extension
- [ ] 建立新檔案: `client/src/app/viewer-extensions/iot-markup.extension.ts`
  - [ ] Extension 基本結構
    ```typescript
    class IotMarkupExtension extends Autodesk.Viewing.Extension {
      constructor(viewer, options);
      load();
      unload();
      addMarker(config);
      updateMarker(bindingId, data);
      removeMarker(bindingId);
      setVisible(visible);
    }
    ```

- [ ] 實作 3D marker 渲染邏輯
  - [ ] 建立 overlay scene
  - [ ] 3D 位置轉 2D 螢幕座標
  - [ ] HTML overlay elements 管理
  - [ ] 視角變化時更新位置

- [ ] 實作 marker 互動功能
  - [ ] Click: 顯示詳細資訊 popup
  - [ ] Hover: 顯示 tooltip
  - [ ] Double-click: 隔離並聚焦元素

### 3.3 整合感測器綁定功能
- [ ] 在 aps-viewer component 中實作
  - [ ] `loadSensorBindings()` - 載入模型的所有綁定
  - [ ] `createIotMarkups()` - 建立所有標記
  - [ ] `getElementPosition()` - 取得 BIM 元素 3D 位置
  - [ ] `focusOnSensor()` - 聚焦到特定感測器

### 3.4 實作綁定編輯模式
- [ ] 建立 "編輯模式" toggle
  ```typescript
  @Input() iotEditMode: boolean = false;
  ```

- [ ] 編輯模式功能
  - [ ] 點擊 BIM 元素選取
  - [ ] 從側邊欄拖曳感測器到 viewer
  - [ ] 視覺化已綁定的元素 (highlight)
  - [ ] 右鍵選單: 解除綁定、調整位置

- [ ] 建立綁定 UI 元件
  ```bash
  ng generate component layout/common/aps-viewer/sensor-binding-panel
  ```
  - [ ] 感測器清單 (可拖曳)
  - [ ] 當前選取的元素資訊
  - [ ] 綁定預覽
  - [ ] 儲存/取消按鈕

### 3.5 樣式設計
- [ ] 建立 marker 樣式: `iot-marker.component.css`
  - [ ] 不同類型的 icon
  - [ ] 狀態顏色 (normal/warning/error)
  - [ ] 動畫效果 (fade in, pulse)
  - [ ] RWD 適配

---

## Phase 4: 即時數據處理

### 4.1 Backend 即時數據接收
- [ ] 決定數據來源架構
  - Option A: MQTT Broker
  - Option B: HTTP polling
  - Option C: WebSocket
  
- [ ] 實作 MQTT Client (如果選用)
  ```python
  # backend/sensors/mqtt_client.py
  import paho.mqtt.client as mqtt
  ```
  - [ ] 連線管理
  - [ ] 訂閱所有感測器 topics
  - [ ] 數據解析和驗證
  - [ ] 寫入 Redis

- [ ] Redis 數據結構設計
  ```
  sensor:{sensor_id}:latest -> JSON
  sensor:{sensor_id}:history -> Sorted Set (by timestamp)
  ```

- [ ] 實作 API endpoint 取得即時數據
  ```python
  GET /api/sensors/{id}/latest_data/
  GET /api/sensors/realtime/?sensor_ids=1,2,3
  ```

### 4.2 Frontend 即時更新機制
- [ ] 實作 polling service
  ```typescript
  // client/src/app/services/realtime-data.service.ts
  ```
  - [ ] 使用 RxJS interval + switchMap
  - [ ] 批次請求多個感測器數據
  - [ ] Error retry 機制
  - [ ] 自動 reconnect

- [ ] (可選) WebSocket 實作
  - [ ] Backend: Django Channels
  - [ ] Frontend: WebSocket client
  - [ ] 訂閱/取消訂閱機制

- [ ] 在 aps-viewer component 整合
  - [ ] `startRealTimeUpdate()`
  - [ ] `updateAllSensorData()`
  - [ ] `updateMarkerValue()`

### 4.3 數據視覺化
- [ ] 實作 sensor detail panel
  ```bash
  ng generate component layout/common/sensor-detail-panel
  ```
  - [ ] 即時數值顯示
  - [ ] 歷史趨勢圖 (Chart.js / ECharts)
  - [ ] 狀態指示器
  - [ ] 最後更新時間

- [ ] 整合圖表庫
  ```bash
  npm install chart.js ng2-charts
  ```

---

## Phase 5: 進階功能

### 5.1 告警系統
- [ ] Backend: 告警規則引擎
  ```python
  # backend/sensors/models.py
  class AlertRule(models.Model):
      sensor = models.ForeignKey(Sensor)
      condition = models.CharField()  # >, <, ==
      threshold = models.FloatField()
      severity = models.CharField()  # info, warning, error
  ```

- [ ] 即時告警檢測
- [ ] 告警通知 (Email, Slack, WebSocket)
- [ ] 告警歷史記錄

### 5.2 數據匯出
- [ ] 匯出感測器配置 (JSON/CSV)
- [ ] 匯出歷史數據 (CSV/Excel)
- [ ] 批次匯入功能

### 5.3 權限控制
- [ ] 感測器管理權限
- [ ] 綁定編輯權限
- [ ] 數據查看權限

---

## Phase 6: 測試與優化

### 6.1 Backend 測試
- [ ] 撰寫 API unit tests
  ```python
  # backend/sensors/tests/test_views.py
  # backend/sensors/tests/test_models.py
  ```

- [ ] 測試案例覆蓋率 > 80%

### 6.2 Frontend 測試
- [ ] Unit tests (Jasmine/Karma)
- [ ] E2E tests (Protractor/Cypress)

### 6.3 效能優化
- [ ] Backend
  - [ ] Database query 優化
  - [ ] 加入 select_related, prefetch_related
  - [ ] Redis caching strategy
  - [ ] API response pagination

- [ ] Frontend
  - [ ] Change Detection 優化 (OnPush)
  - [ ] Lazy loading modules
  - [ ] Viewer rendering 優化
  - [ ] 減少不必要的 API calls

### 6.4 文件撰寫
- [ ] API 文件 (Swagger/OpenAPI)
- [ ] 使用者手冊
- [ ] 開發者指南
- [ ] 部署文件

---

## Phase 7: 部署準備

### 7.1 Docker 設定更新
- [ ] 更新 `docker-compose.yml`
  - [ ] 加入 Redis service
  - [ ] 加入 MQTT Broker (Mosquitto) service
  - [ ] 環境變數設定

- [ ] 更新 Django settings
  - [ ] Redis configuration
  - [ ] MQTT configuration
  - [ ] CORS settings for WebSocket

### 7.2 環境變數設定
- [ ] `.env.example` 範本
  ```
  MQTT_BROKER_HOST=mqtt
  MQTT_BROKER_PORT=1883
  REDIS_HOST=redis
  REDIS_PORT=6379
  ```

### 7.3 資料庫遷移腳本
- [ ] 生產環境遷移指南
- [ ] Rollback 策略

---

## 開發優先順序建議

### Sprint 1 (Week 1-2): 基礎架構
- Phase 1.1 - 1.4: Backend Models & APIs
- Phase 2.1: Frontend Service

### Sprint 2 (Week 2-3): 管理介面
- Phase 2.2 - 2.3: 感測器管理頁面

### Sprint 3 (Week 3-5): Viewer 整合
- Phase 3.1 - 3.3: IoT Markup Extension
- Phase 3.4: 綁定編輯功能

### Sprint 4 (Week 5-6): 即時數據
- Phase 4.1 - 4.3: 即時數據處理與顯示

### Sprint 5 (Week 7): 測試與優化
- Phase 6.1 - 6.3: 測試與效能優化

### Sprint 6 (Week 8): 進階功能與部署
- Phase 5 (選擇性)
- Phase 7: 部署準備

---

## 技術決策 Checkpoints

在開始開發前需要確認：

### 1. IoT 數據來源
- [ ] 確認感測器通訊協議 (MQTT/Modbus/HTTP)
- [ ] 確認數據格式
- [ ] 確認更新頻率

### 2. 歷史數據儲存
- [ ] 使用 PostgreSQL
- [ ] 使用 TimeScaleDB
- [ ] 使用 InfluxDB
- [ ] 只保留在 Redis (不持久化)

### 3. 前端框架選擇
- [ ] 確認 Angular 版本
- [ ] 選擇 UI 元件庫 (Material, PrimeNG, etc.)
- [ ] 圖表庫選擇

### 4. 部署環境
- [ ] 開發環境設定
- [ ] 測試環境需求
- [ ] 生產環境規劃

---

## 相關資源

### Documentation
- [Autodesk Forge Viewer API](https://forge.autodesk.com/en/docs/viewer/v7/developers_guide/overview/)
- [Django REST Framework](https://www.django-rest-framework.org/)
- [Angular Documentation](https://angular.io/docs)
- [MQTT Protocol](https://mqtt.org/)

### Code Examples
- Forge Viewer Extensions: `https://github.com/Autodesk-Forge/viewer-extensions-samples`
- Django MQTT: `https://github.com/emqx/mqtt-client-python`

---

## Notes

- 保持 git commits 小而頻繁
- 每個 feature 使用獨立 branch
- 重要變更需要 code review
- 持續更新此 TODO list

**最後更新**: 2025-12-11
**專案負責人**: Jeffer
**專案**: tx_bmms - Building Model Management System

# tx_bmms IoT Integration Development Guide with VerneMQ

## 專案概述
在現有的 BMMS (Building Model Management System) 中整合 IoT 即時監測功能，使用 VerneMQ 作為 MQTT Broker，實現感測器數據與 BIM 元素的綁定顯示。

**技術棧**
- Backend: Django + PostgreSQL + Redis
- Frontend: Angular + TypeScript
- 3D Viewer: Autodesk Forge Viewer
- MQTT Broker: VerneMQ
- 即時通訊: MQTT / WebSocket

---

## Phase 0: Docker 環境設定

### 0.1 更新 docker-compose.yml

在現有的 `docker-compose.yml` 中加入以下服務：

```yaml
# docker-compose.yml

version: '3.8'

services:
  # ... 現有的服務 (backend, client, db, redis, elfinder) ...

  # MQTT Broker - VerneMQ
  vernemq:
    image: vernemq/vernemq:latest
    container_name: tx_bmms_vernemq
    restart: always
    environment:
      # 接受 EULA
      DOCKER_VERNEMQ_ACCEPT_EULA: 'yes'
      
      # 允許匿名連線 (開發環境使用，生產環境應改為 'off')
      DOCKER_VERNEMQ_ALLOW_ANONYMOUS: 'on'
      
      # MQTT TCP Listener (標準 MQTT 協議)
      DOCKER_VERNEMQ_LISTENER__TCP__DEFAULT: '0.0.0.0:1883'
      
      # WebSocket Listener (網頁瀏覽器使用)
      DOCKER_VERNEMQ_LISTENER__WS__DEFAULT: '0.0.0.0:8083'
      
      # WebSocket Secure Listener (HTTPS 網頁使用)
      DOCKER_VERNEMQ_LISTENER__WSS__DEFAULT: '0.0.0.0:8084'
      
      # Log 設定
      DOCKER_VERNEMQ_LOG__CONSOLE__LEVEL: 'info'
      DOCKER_VERNEMQ_LOG__CONSOLE__FILE: '/vernemq/log/vernemq.log'
      
      # SSL/TLS 憑證設定 (生產環境啟用)
      # DOCKER_VERNEMQ_LISTENER__WSS__CAFILE: '/etc/letsencrypt/live/your-domain.com/fullchain.pem'
      # DOCKER_VERNEMQ_LISTENER__WSS__CERTFILE: '/etc/letsencrypt/live/your-domain.com/cert.pem'
      # DOCKER_VERNEMQ_LISTENER__WSS__KEYFILE: '/etc/letsencrypt/live/your-domain.com/privkey.pem'
      
      # 其他選用設定
      DOCKER_VERNEMQ_MAX_CLIENT_ID_SIZE: '100'
      DOCKER_VERNEMQ_MAX_OFFLINE_MESSAGES: '1000'
      DOCKER_VERNEMQ_MAX_ONLINE_MESSAGES: '1000'
      
    ports:
      - "1883:1883"    # MQTT TCP
      - "8083:8083"    # MQTT WebSocket
      # - "8084:8084"  # MQTT WebSocket Secure (需要 SSL 憑證)
      # - "8888:8888"  # VerneMQ HTTP API (管理用)
      
    volumes:
      # SSL 憑證 (如果有的話)
      - /etc/letsencrypt:/etc/letsencrypt:ro
      
      # Log 目錄
      - ./vernemq/log:/vernemq/log
      
      # 持久化數據 (訂閱、保留消息等)
      - ./vernemq/data:/vernemq/data
      
    networks:
      - internal_network
    
    healthcheck:
      test: ["CMD", "vernemq", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Redis (如果還沒有的話)
  redis:
    image: redis:7-alpine
    container_name: tx_bmms_redis
    restart: always
    ports:
      - "6379:6379"
    volumes:
      - ./redis/data:/data
    command: redis-server --appendonly yes
    networks:
      - internal_network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

networks:
  internal_network:
    driver: bridge

volumes:
  vernemq_data:
  redis_data:
```

### 0.2 建立必要的目錄

```bash
# 在專案根目錄執行
mkdir -p vernemq/log
mkdir -p vernemq/data
mkdir -p redis/data

# 設定權限
chmod -R 755 vernemq
chmod -R 755 redis
```

### 0.3 啟動服務

```bash
# 重新建構並啟動所有服務
docker-compose up -d --build

# 查看 VerneMQ 日誌
docker-compose logs -f vernemq

# 驗證 VerneMQ 是否正常運行
docker-compose exec vernemq vernemq ping
```

### 0.4 VerneMQ 基本測試

使用 MQTT 測試工具驗證連線：

```bash
# 使用 mosquitto_pub/sub 測試 (需先安裝 mosquitto-clients)
# 訂閱測試
mosquitto_sub -h localhost -p 1883 -t "test/topic"

# 發布測試 (另開一個終端)
mosquitto_pub -h localhost -p 1883 -t "test/topic" -m "Hello MQTT"
```

或使用 MQTT.fx、MQTTX 等 GUI 工具測試。

### 0.5 環境變數設定

建立或更新 `.env` 檔案：

```bash
# .env

# MQTT Broker 設定
MQTT_BROKER_HOST=vernemq
MQTT_BROKER_PORT=1883
MQTT_BROKER_WS_PORT=8083
MQTT_BROKER_WSS_PORT=8084
MQTT_BROKER_USERNAME=
MQTT_BROKER_PASSWORD=
MQTT_KEEPALIVE=60
MQTT_CLIENT_ID_PREFIX=tx_bmms

# Redis 設定
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=

# Sensor Data 設定
SENSOR_DATA_RETENTION_HOURS=168  # 保留 7 天
SENSOR_DATA_UPDATE_INTERVAL=5    # 秒
```

---

## Phase 1: 資料庫設計與 Backend 基礎架構

### 1.1 建立資料庫 Models

```bash
cd backend
python manage.py startapp sensors
```

**backend/sensors/models.py**

```python
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
import json

class Sensor(models.Model):
    """感測器主表 - 代表一個實際的監測點"""
    
    SENSOR_TYPE_CHOICES = [
        ('temperature', '溫度'),
        ('humidity', '濕度'),
        ('pressure', '壓力'),
        ('flow', '流量'),
        ('power', '功率'),
        ('voltage', '電壓'),
        ('current', '電流'),
        ('status', '狀態'),
        ('occupancy', '佔用率'),
        ('co2', 'CO2濃度'),
    ]
    
    # 基本資訊
    sensor_id = models.CharField(max_length=100, unique=True, verbose_name='感測器ID')
    name = models.CharField(max_length=200, verbose_name='名稱')
    description = models.TextField(blank=True, verbose_name='描述')
    sensor_type = models.CharField(max_length=50, choices=SENSOR_TYPE_CHOICES, verbose_name='類型')
    unit = models.CharField(max_length=20, verbose_name='單位')
    
    # MQTT 設定
    mqtt_topic = models.CharField(max_length=255, blank=True, verbose_name='MQTT Topic')
    mqtt_qos = models.IntegerField(default=1, validators=[MinValueValidator(0), MaxValueValidator(2)], 
                                   verbose_name='QoS等級')
    
    # Modbus 設定 (如果需要)
    modbus_address = models.IntegerField(null=True, blank=True, verbose_name='Modbus地址')
    modbus_register = models.IntegerField(null=True, blank=True, verbose_name='Modbus暫存器')
    
    # API 設定 (如果需要)
    api_endpoint = models.URLField(blank=True, verbose_name='API端點')
    api_method = models.CharField(max_length=10, default='GET', verbose_name='API方法')
    
    # 顯示設定
    display_format = models.CharField(max_length=50, default='{value} {unit}', 
                                     verbose_name='顯示格式')
    decimal_places = models.IntegerField(default=2, validators=[MinValueValidator(0), MaxValueValidator(6)],
                                        verbose_name='小數位數')
    
    # 告警閾值
    warning_threshold_min = models.FloatField(null=True, blank=True, verbose_name='警告下限')
    warning_threshold_max = models.FloatField(null=True, blank=True, verbose_name='警告上限')
    error_threshold_min = models.FloatField(null=True, blank=True, verbose_name='錯誤下限')
    error_threshold_max = models.FloatField(null=True, blank=True, verbose_name='錯誤上限')
    
    # 資料轉換 (可選)
    data_transform = models.JSONField(null=True, blank=True, 
                                     help_text='{"scale": 1.0, "offset": 0.0}',
                                     verbose_name='數據轉換')
    
    # 狀態
    is_active = models.BooleanField(default=True, verbose_name='啟用')
    last_seen = models.DateTimeField(null=True, blank=True, verbose_name='最後連線時間')
    
    # 時間戳
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')
    
    class Meta:
        db_table = 'sensors'
        ordering = ['sensor_id']
        indexes = [
            models.Index(fields=['sensor_type', 'is_active']),
            models.Index(fields=['mqtt_topic']),
        ]
        verbose_name = '感測器'
        verbose_name_plural = '感測器'
    
    def __str__(self):
        return f"{self.sensor_id} - {self.name}"
    
    def get_status(self, value):
        """根據數值判斷狀態"""
        if value is None:
            return 'unknown'
        
        if self.error_threshold_min is not None and value < self.error_threshold_min:
            return 'error'
        if self.error_threshold_max is not None and value > self.error_threshold_max:
            return 'error'
        if self.warning_threshold_min is not None and value < self.warning_threshold_min:
            return 'warning'
        if self.warning_threshold_max is not None and value > self.warning_threshold_max:
            return 'warning'
        
        return 'normal'


class SensorBimBinding(models.Model):
    """感測器與 BIM Element 的綁定關係"""
    
    POSITION_TYPE_CHOICES = [
        ('center', '中心'),
        ('top', '頂部'),
        ('bottom', '底部'),
        ('custom', '自訂'),
    ]
    
    sensor = models.ForeignKey(Sensor, on_delete=models.CASCADE, 
                              related_name='bim_bindings', verbose_name='感測器')
    
    # BIM Element 識別
    model_urn = models.CharField(max_length=255, verbose_name='模型URN')
    element_dbid = models.IntegerField(verbose_name='元素DbId')
    element_external_id = models.CharField(max_length=255, blank=True, verbose_name='外部ID')
    element_name = models.CharField(max_length=255, blank=True, verbose_name='元素名稱')
    
    # 顯示位置設定
    position_type = models.CharField(max_length=20, default='center', 
                                    choices=POSITION_TYPE_CHOICES, verbose_name='位置類型')
    position_offset = models.JSONField(null=True, blank=True, 
                                      help_text='{"x": 0, "y": 0, "z": 0}',
                                      verbose_name='位置偏移')
    
    # 顯示樣式
    label_visible = models.BooleanField(default=True, verbose_name='顯示標籤')
    icon_type = models.CharField(max_length=50, blank=True, verbose_name='圖示類型')
    color = models.CharField(max_length=20, blank=True, verbose_name='顏色')
    
    # 其他
    priority = models.IntegerField(default=0, verbose_name='優先順序')
    notes = models.TextField(blank=True, verbose_name='備註')
    is_active = models.BooleanField(default=True, verbose_name='啟用')
    
    # 時間戳
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='建立時間')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新時間')
    
    class Meta:
        db_table = 'sensor_bim_bindings'
        unique_together = [['sensor', 'model_urn', 'element_dbid']]
        ordering = ['priority', 'created_at']
        verbose_name = '感測器BIM綁定'
        verbose_name_plural = '感測器BIM綁定'
    
    def __str__(self):
        return f"{self.sensor.sensor_id} -> {self.model_urn}:{self.element_dbid}"


class SensorDataLog(models.Model):
    """感測器數據日誌 (可選，用於歷史數據分析)"""
    
    STATUS_CHOICES = [
        ('normal', '正常'),
        ('warning', '警告'),
        ('error', '錯誤'),
        ('offline', '離線'),
    ]
    
    sensor = models.ForeignKey(Sensor, on_delete=models.CASCADE, 
                              related_name='data_logs', verbose_name='感測器')
    value = models.FloatField(verbose_name='數值')
    raw_value = models.FloatField(null=True, blank=True, verbose_name='原始數值')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, 
                             default='normal', verbose_name='狀態')
    timestamp = models.DateTimeField(db_index=True, verbose_name='時間戳')
    
    class Meta:
        db_table = 'sensor_data_logs'
        indexes = [
            models.Index(fields=['sensor', '-timestamp']),
            models.Index(fields=['status', '-timestamp']),
        ]
        ordering = ['-timestamp']
        verbose_name = '感測器數據日誌'
        verbose_name_plural = '感測器數據日誌'
    
    def __str__(self):
        return f"{self.sensor.sensor_id} - {self.value} at {self.timestamp}"
```

### 1.2 執行 Migration

```bash
# 將 sensors app 加入 INSTALLED_APPS
# backend/backend/settings.py
INSTALLED_APPS = [
    # ...
    'sensors',
]

# 建立並執行 migrations
python manage.py makemigrations sensors
python manage.py migrate sensors
```

### 1.3 Django Admin 註冊

```python
# backend/sensors/admin.py

from django.contrib import admin
from .models import Sensor, SensorBimBinding, SensorDataLog

@admin.register(Sensor)
class SensorAdmin(admin.ModelAdmin):
    list_display = ['sensor_id', 'name', 'sensor_type', 'unit', 'is_active', 'last_seen']
    list_filter = ['sensor_type', 'is_active', 'created_at']
    search_fields = ['sensor_id', 'name', 'mqtt_topic']
    readonly_fields = ['created_at', 'updated_at', 'last_seen']
    
    fieldsets = (
        ('基本資訊', {
            'fields': ('sensor_id', 'name', 'description', 'sensor_type', 'unit')
        }),
        ('MQTT 設定', {
            'fields': ('mqtt_topic', 'mqtt_qos')
        }),
        ('顯示設定', {
            'fields': ('display_format', 'decimal_places')
        }),
        ('告警閾值', {
            'fields': ('warning_threshold_min', 'warning_threshold_max', 
                      'error_threshold_min', 'error_threshold_max')
        }),
        ('狀態', {
            'fields': ('is_active', 'last_seen', 'created_at', 'updated_at')
        }),
    )

@admin.register(SensorBimBinding)
class SensorBimBindingAdmin(admin.ModelAdmin):
    list_display = ['sensor', 'model_urn', 'element_dbid', 'position_type', 'is_active']
    list_filter = ['position_type', 'is_active', 'created_at']
    search_fields = ['sensor__sensor_id', 'sensor__name', 'element_name']
    raw_id_fields = ['sensor']

@admin.register(SensorDataLog)
class SensorDataLogAdmin(admin.ModelAdmin):
    list_display = ['sensor', 'value', 'status', 'timestamp']
    list_filter = ['status', 'timestamp']
    search_fields = ['sensor__sensor_id']
    date_hierarchy = 'timestamp'
    raw_id_fields = ['sensor']
```

---

## Phase 2: Backend MQTT 整合

### 2.1 安裝必要的套件

```bash
# backend/requirements.txt 加入以下套件
paho-mqtt==1.6.1
redis==5.0.1
celery==5.3.4
```

```bash
pip install -r requirements.txt
```

### 2.2 MQTT Client 實作

```python
# backend/sensors/mqtt_client.py

import paho.mqtt.client as mqtt
import json
import logging
from datetime import datetime
from django.conf import settings
from django.utils import timezone
import redis

logger = logging.getLogger(__name__)

class MQTTClient:
    """MQTT Client 用於接收感測器數據"""
    
    def __init__(self):
        self.client = None
        self.redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            decode_responses=True
        )
        self.connected = False
    
    def connect(self):
        """連線到 MQTT Broker"""
        try:
            self.client = mqtt.Client(
                client_id=f"{settings.MQTT_CLIENT_ID_PREFIX}_backend_{datetime.now().timestamp()}"
            )
            
            # 設定回調函數
            self.client.on_connect = self.on_connect
            self.client.on_disconnect = self.on_disconnect
            self.client.on_message = self.on_message
            
            # 連線
            self.client.connect(
                settings.MQTT_BROKER_HOST,
                settings.MQTT_BROKER_PORT,
                settings.MQTT_KEEPALIVE
            )
            
            # 開始非阻塞式循環
            self.client.loop_start()
            
            logger.info(f"Connecting to MQTT Broker at {settings.MQTT_BROKER_HOST}:{settings.MQTT_BROKER_PORT}")
            
        except Exception as e:
            logger.error(f"Failed to connect to MQTT Broker: {e}")
            raise
    
    def disconnect(self):
        """斷開連線"""
        if self.client:
            self.client.loop_stop()
            self.client.disconnect()
            self.connected = False
            logger.info("Disconnected from MQTT Broker")
    
    def on_connect(self, client, userdata, flags, rc):
        """連線成功回調"""
        if rc == 0:
            self.connected = True
            logger.info("Connected to MQTT Broker successfully")
            
            # 訂閱所有感測器的 topics
            self.subscribe_all_sensors()
        else:
            logger.error(f"Failed to connect to MQTT Broker, return code: {rc}")
    
    def on_disconnect(self, client, userdata, rc):
        """斷線回調"""
        self.connected = False
        if rc != 0:
            logger.warning(f"Unexpected disconnection from MQTT Broker, return code: {rc}")
        else:
            logger.info("Disconnected from MQTT Broker")
    
    def on_message(self, client, userdata, msg):
        """接收到訊息的回調"""
        try:
            # 解析訊息
            topic = msg.topic
            payload = msg.payload.decode('utf-8')
            
            logger.debug(f"Received message on topic '{topic}': {payload}")
            
            # 解析 JSON 數據
            try:
                data = json.loads(payload)
            except json.JSONDecodeError:
                # 如果不是 JSON，嘗試解析為數字
                try:
                    data = {'value': float(payload)}
                except ValueError:
                    logger.warning(f"Unable to parse payload: {payload}")
                    return
            
            # 處理數據
            self.process_sensor_data(topic, data)
            
        except Exception as e:
            logger.error(f"Error processing message: {e}")
    
    def process_sensor_data(self, topic, data):
        """處理感測器數據"""
        from .models import Sensor
        
        try:
            # 查找對應的感測器
            sensor = Sensor.objects.get(mqtt_topic=topic, is_active=True)
            
            # 提取數值
            value = data.get('value')
            if value is None:
                logger.warning(f"No 'value' field in data for topic: {topic}")
                return
            
            # 數據轉換
            if sensor.data_transform:
                scale = sensor.data_transform.get('scale', 1.0)
                offset = sensor.data_transform.get('offset', 0.0)
                value = value * scale + offset
            
            # 判斷狀態
            status = sensor.get_status(value)
            
            # 更新 Redis (即時數據)
            sensor_data = {
                'sensor_id': sensor.sensor_id,
                'value': round(value, sensor.decimal_places),
                'unit': sensor.unit,
                'status': status,
                'timestamp': data.get('timestamp', timezone.now().isoformat()),
            }
            
            redis_key = f"sensor:{sensor.sensor_id}:latest"
            self.redis_client.setex(
                redis_key,
                3600,  # 1小時過期
                json.dumps(sensor_data)
            )
            
            # 更新最後連線時間
            sensor.last_seen = timezone.now()
            sensor.save(update_fields=['last_seen'])
            
            # (可選) 寫入資料庫歷史
            if settings.SENSOR_DATA_SAVE_TO_DB:
                from .models import SensorDataLog
                SensorDataLog.objects.create(
                    sensor=sensor,
                    value=value,
                    status=status,
                    timestamp=timezone.now()
                )
            
            logger.debug(f"Processed data for sensor {sensor.sensor_id}: {value} {sensor.unit}")
            
        except Sensor.DoesNotExist:
            logger.warning(f"No active sensor found for topic: {topic}")
        except Exception as e:
            logger.error(f"Error processing sensor data: {e}")
    
    def subscribe_all_sensors(self):
        """訂閱所有啟用的感測器 topics"""
        from .models import Sensor
        
        sensors = Sensor.objects.filter(is_active=True).exclude(mqtt_topic='')
        
        for sensor in sensors:
            try:
                self.client.subscribe(sensor.mqtt_topic, qos=sensor.mqtt_qos)
                logger.info(f"Subscribed to topic: {sensor.mqtt_topic}")
            except Exception as e:
                logger.error(f"Failed to subscribe to topic {sensor.mqtt_topic}: {e}")
    
    def publish(self, topic, payload, qos=1):
        """發布訊息 (用於控制感測器)"""
        if not self.connected:
            logger.warning("Not connected to MQTT Broker")
            return False
        
        try:
            if isinstance(payload, dict):
                payload = json.dumps(payload)
            
            result = self.client.publish(topic, payload, qos=qos)
            
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                logger.info(f"Published to topic '{topic}': {payload}")
                return True
            else:
                logger.error(f"Failed to publish to topic '{topic}'")
                return False
                
        except Exception as e:
            logger.error(f"Error publishing message: {e}")
            return False


# 全域 MQTT Client 實例
mqtt_client = None

def get_mqtt_client():
    """取得 MQTT Client 實例"""
    global mqtt_client
    if mqtt_client is None:
        mqtt_client = MQTTClient()
    return mqtt_client
```

### 2.3 Django Settings 更新

```python
# backend/backend/settings.py

# MQTT 設定
MQTT_BROKER_HOST = os.getenv('MQTT_BROKER_HOST', 'vernemq')
MQTT_BROKER_PORT = int(os.getenv('MQTT_BROKER_PORT', 1883))
MQTT_BROKER_USERNAME = os.getenv('MQTT_BROKER_USERNAME', '')
MQTT_BROKER_PASSWORD = os.getenv('MQTT_BROKER_PASSWORD', '')
MQTT_KEEPALIVE = int(os.getenv('MQTT_KEEPALIVE', 60))
MQTT_CLIENT_ID_PREFIX = os.getenv('MQTT_CLIENT_ID_PREFIX', 'tx_bmms')

# Redis 設定
REDIS_HOST = os.getenv('REDIS_HOST', 'redis')
REDIS_PORT = int(os.getenv('REDIS_PORT', 6379))
REDIS_DB = int(os.getenv('REDIS_DB', 0))
REDIS_PASSWORD = os.getenv('REDIS_PASSWORD', '')

# Sensor Data 設定
SENSOR_DATA_SAVE_TO_DB = os.getenv('SENSOR_DATA_SAVE_TO_DB', 'False').lower() == 'true'
SENSOR_DATA_RETENTION_HOURS = int(os.getenv('SENSOR_DATA_RETENTION_HOURS', 168))
```

### 2.4 Django App 啟動時連線 MQTT

```python
# backend/sensors/apps.py

from django.apps import AppConfig
import logging

logger = logging.getLogger(__name__)

class SensorsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'sensors'
    verbose_name = '感測器管理'
    
    def ready(self):
        """App 準備好時執行"""
        import os
        
        # 只在主進程中啟動 MQTT Client (避免在 migration 時執行)
        if os.environ.get('RUN_MAIN') == 'true' or os.environ.get('DJANGO_SETTINGS_MODULE'):
            try:
                from .mqtt_client import get_mqtt_client
                client = get_mqtt_client()
                client.connect()
                logger.info("MQTT Client started successfully")
            except Exception as e:
                logger.error(f"Failed to start MQTT Client: {e}")
```

### 2.5 建立 Serializers

```python
# backend/sensors/serializers.py

from rest_framework import serializers
from .models import Sensor, SensorBimBinding, SensorDataLog
import redis
import json
from django.conf import settings

class SensorSerializer(serializers.ModelSerializer):
    bim_bindings_count = serializers.SerializerMethodField()
    latest_value = serializers.SerializerMethodField()
    
    class Meta:
        model = Sensor
        fields = '__all__'
    
    def get_bim_bindings_count(self, obj):
        return obj.bim_bindings.filter(is_active=True).count()
    
    def get_latest_value(self, obj):
        """從 Redis 取得最新數據"""
        try:
            redis_client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                db=settings.REDIS_DB,
                decode_responses=True
            )
            
            redis_key = f"sensor:{obj.sensor_id}:latest"
            data = redis_client.get(redis_key)
            
            if data:
                return json.loads(data)
            return None
            
        except Exception:
            return None


class SensorBimBindingSerializer(serializers.ModelSerializer):
    sensor_detail = SensorSerializer(source='sensor', read_only=True)
    
    class Meta:
        model = SensorBimBinding
        fields = '__all__'


class SensorDataLogSerializer(serializers.ModelSerializer):
    sensor_name = serializers.CharField(source='sensor.name', read_only=True)
    
    class Meta:
        model = SensorDataLog
        fields = '__all__'
```

### 2.6 建立 ViewSets

```python
# backend/sensors/views.py

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from datetime import timedelta
import redis
import json
from django.conf import settings

from .models import Sensor, SensorBimBinding, SensorDataLog
from .serializers import (
    SensorSerializer, 
    SensorBimBindingSerializer, 
    SensorDataLogSerializer
)

class SensorViewSet(viewsets.ModelViewSet):
    queryset = Sensor.objects.all()
    serializer_class = SensorSerializer
    filterset_fields = ['sensor_type', 'is_active']
    search_fields = ['sensor_id', 'name', 'mqtt_topic']
    ordering_fields = ['sensor_id', 'name', 'created_at']
    
    @action(detail=True, methods=['get'])
    def bindings(self, request, pk=None):
        """取得特定感測器的所有綁定"""
        sensor = self.get_object()
        bindings = sensor.bim_bindings.filter(is_active=True)
        serializer = SensorBimBindingSerializer(bindings, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def latest_data(self, request, pk=None):
        """取得感測器最新數據"""
        sensor = self.get_object()
        
        try:
            redis_client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                db=settings.REDIS_DB,
                decode_responses=True
            )
            
            redis_key = f"sensor:{sensor.sensor_id}:latest"
            data = redis_client.get(redis_key)
            
            if data:
                return Response(json.loads(data))
            else:
                return Response({
                    'sensor_id': sensor.sensor_id,
                    'value': None,
                    'unit': sensor.unit,
                    'status': 'offline',
                    'timestamp': None,
                    'message': 'No recent data'
                })
                
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def realtime(self, request):
        """批次取得多個感測器的即時數據"""
        sensor_ids = request.query_params.get('sensor_ids', '').split(',')
        sensor_ids = [sid.strip() for sid in sensor_ids if sid.strip()]
        
        if not sensor_ids:
            return Response(
                {'error': 'sensor_ids parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            redis_client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                db=settings.REDIS_DB,
                decode_responses=True
            )
            
            result = {}
            for sensor_id in sensor_ids:
                redis_key = f"sensor:{sensor_id}:latest"
                data = redis_client.get(redis_key)
                if data:
                    result[sensor_id] = json.loads(data)
                else:
                    result[sensor_id] = None
            
            return Response(result)
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """取得歷史數據"""
        sensor = self.get_object()
        
        # 時間範圍
        hours = int(request.query_params.get('hours', 24))
        start_time = timezone.now() - timedelta(hours=hours)
        
        logs = SensorDataLog.objects.filter(
            sensor=sensor,
            timestamp__gte=start_time
        ).order_by('timestamp')
        
        serializer = SensorDataLogSerializer(logs, many=True)
        return Response(serializer.data)


class SensorBimBindingViewSet(viewsets.ModelViewSet):
    queryset = SensorBimBinding.objects.all()
    serializer_class = SensorBimBindingSerializer
    filterset_fields = ['sensor', 'model_urn', 'is_active']
    
    @action(detail=False, methods=['get'])
    def by_model(self, request):
        """根據 model URN 取得所有綁定"""
        model_urn = request.query_params.get('model_urn')
        if not model_urn:
            return Response(
                {'error': 'model_urn is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        bindings = self.queryset.filter(
            model_urn=model_urn,
            is_active=True
        ).select_related('sensor')
        
        serializer = self.get_serializer(bindings, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def batch_create(self, request):
        """批次建立綁定"""
        bindings_data = request.data.get('bindings', [])
        created = []
        errors = []
        
        for idx, binding_data in enumerate(bindings_data):
            serializer = self.get_serializer(data=binding_data)
            if serializer.is_valid():
                serializer.save()
                created.append(serializer.data)
            else:
                errors.append({
                    'index': idx,
                    'data': binding_data,
                    'errors': serializer.errors
                })
        
        return Response({
            'created': created,
            'errors': errors
        }, status=status.HTTP_201_CREATED if created else status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def batch_delete(self, request):
        """批次刪除綁定"""
        binding_ids = request.data.get('binding_ids', [])
        
        if not binding_ids:
            return Response(
                {'error': 'binding_ids is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        deleted_count = self.queryset.filter(id__in=binding_ids).delete()[0]
        
        return Response({
            'deleted_count': deleted_count
        })
```

### 2.7 URL 設定

```python
# backend/sensors/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SensorViewSet, SensorBimBindingViewSet

router = DefaultRouter()
router.register(r'sensors', SensorViewSet, basename='sensor')
router.register(r'bindings', SensorBimBindingViewSet, basename='binding')

urlpatterns = [
    path('', include(router.urls)),
]
```

```python
# backend/backend/urls.py

urlpatterns = [
    # ... 其他 URLs
    path('api/sensors/', include('sensors.urls')),
]
```

---

## Phase 3: Frontend 實作

### 3.1 建立 Sensor Service

```typescript
// client/src/app/services/sensor.service.ts

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Sensor {
  id: number;
  sensor_id: string;
  name: string;
  description?: string;
  sensor_type: string;
  unit: string;
  mqtt_topic: string;
  mqtt_qos: number;
  display_format: string;
  decimal_places: number;
  warning_threshold_min?: number;
  warning_threshold_max?: number;
  error_threshold_min?: number;
  error_threshold_max?: number;
  is_active: boolean;
  last_seen?: string;
  bim_bindings_count?: number;
  latest_value?: SensorData;
}

export interface SensorBimBinding {
  id: number;
  sensor: number;
  sensor_detail?: Sensor;
  model_urn: string;
  element_dbid: number;
  element_external_id: string;
  element_name?: string;
  position_type: 'center' | 'top' | 'bottom' | 'custom';
  position_offset?: { x: number; y: number; z: number };
  label_visible: boolean;
  icon_type?: string;
  color?: string;
  priority: number;
  notes?: string;
  is_active: boolean;
}

export interface SensorData {
  sensor_id: string;
  value: number;
  unit: string;
  status: 'normal' | 'warning' | 'error' | 'offline' | 'unknown';
  timestamp: string;
}

export interface SensorDataLog {
  id: number;
  sensor: number;
  sensor_name: string;
  value: number;
  raw_value?: number;
  status: string;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class SensorService {
  private apiUrl = `${environment.apiUrl}/sensors`;

  constructor(private http: HttpClient) {}

  // Sensor CRUD
  getSensors(params?: any): Observable<Sensor[]> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get<Sensor[]>(`${this.apiUrl}/sensors/`, { params: httpParams });
  }

  getSensor(id: number): Observable<Sensor> {
    return this.http.get<Sensor>(`${this.apiUrl}/sensors/${id}/`);
  }

  createSensor(sensor: Partial<Sensor>): Observable<Sensor> {
    return this.http.post<Sensor>(`${this.apiUrl}/sensors/`, sensor);
  }

  updateSensor(id: number, sensor: Partial<Sensor>): Observable<Sensor> {
    return this.http.patch<Sensor>(`${this.apiUrl}/sensors/${id}/`, sensor);
  }

  deleteSensor(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/sensors/${id}/`);
  }

  // Sensor Data
  getSensorLatestData(sensorId: number): Observable<SensorData> {
    return this.http.get<SensorData>(`${this.apiUrl}/sensors/${sensorId}/latest_data/`);
  }

  getRealtimeData(sensorIds: string[]): Observable<{ [key: string]: SensorData }> {
    const params = new HttpParams().set('sensor_ids', sensorIds.join(','));
    return this.http.get<{ [key: string]: SensorData }>(
      `${this.apiUrl}/sensors/realtime/`,
      { params }
    );
  }

  getSensorHistory(sensorId: number, hours: number = 24): Observable<SensorDataLog[]> {
    const params = new HttpParams().set('hours', hours.toString());
    return this.http.get<SensorDataLog[]>(
      `${this.apiUrl}/sensors/${sensorId}/history/`,
      { params }
    );
  }

  // Bindings
  getSensorBindings(sensorId: number): Observable<SensorBimBinding[]> {
    return this.http.get<SensorBimBinding[]>(`${this.apiUrl}/sensors/${sensorId}/bindings/`);
  }

  getBindingsByModel(modelUrn: string): Observable<SensorBimBinding[]> {
    const params = new HttpParams().set('model_urn', modelUrn);
    return this.http.get<SensorBimBinding[]>(
      `${this.apiUrl}/bindings/by_model/`,
      { params }
    );
  }

  createBinding(binding: Partial<SensorBimBinding>): Observable<SensorBimBinding> {
    return this.http.post<SensorBimBinding>(`${this.apiUrl}/bindings/`, binding);
  }

  updateBinding(id: number, binding: Partial<SensorBimBinding>): Observable<SensorBimBinding> {
    return this.http.patch<SensorBimBinding>(`${this.apiUrl}/bindings/${id}/`, binding);
  }

  deleteBinding(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/bindings/${id}/`);
  }

  batchCreateBindings(bindings: Partial<SensorBimBinding>[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/bindings/batch_create/`, { bindings });
  }

  batchDeleteBindings(bindingIds: number[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/bindings/batch_delete/`, { binding_ids: bindingIds });
  }
}
```

### 3.2 MQTT WebSocket Client (前端直接連線)

```typescript
// client/src/app/services/mqtt-websocket.service.ts

import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import * as mqtt from 'mqtt';
import { environment } from '../../environments/environment';

export interface MqttMessage {
  topic: string;
  payload: any;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class MqttWebsocketService {
  private client: mqtt.MqttClient | null = null;
  private messageSubject = new Subject<MqttMessage>();
  private connectedSubject = new Subject<boolean>();
  private connected = false;

  constructor() {}

  connect(): void {
    if (this.client && this.connected) {
      console.log('Already connected to MQTT broker');
      return;
    }

    const wsUrl = `ws://${environment.mqttBrokerHost}:${environment.mqttBrokerWsPort}`;
    
    this.client = mqtt.connect(wsUrl, {
      clientId: `tx_bmms_web_${Math.random().toString(16).substr(2, 8)}`,
      clean: true,
      reconnectPeriod: 5000,
    });

    this.client.on('connect', () => {
      console.log('Connected to MQTT broker via WebSocket');
      this.connected = true;
      this.connectedSubject.next(true);
    });

    this.client.on('disconnect', () => {
      console.log('Disconnected from MQTT broker');
      this.connected = false;
      this.connectedSubject.next(false);
    });

    this.client.on('message', (topic, payload) => {
      try {
        const data = JSON.parse(payload.toString());
        this.messageSubject.next({
          topic,
          payload: data,
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Error parsing MQTT message:', error);
      }
    });

    this.client.on('error', (error) => {
      console.error('MQTT connection error:', error);
    });
  }

  disconnect(): void {
    if (this.client) {
      this.client.end();
      this.client = null;
      this.connected = false;
    }
  }

  subscribe(topic: string, qos: 0 | 1 | 2 = 1): void {
    if (this.client && this.connected) {
      this.client.subscribe(topic, { qos }, (error) => {
        if (error) {
          console.error(`Failed to subscribe to topic ${topic}:`, error);
        } else {
          console.log(`Subscribed to topic: ${topic}`);
        }
      });
    }
  }

  unsubscribe(topic: string): void {
    if (this.client && this.connected) {
      this.client.unsubscribe(topic, (error) => {
        if (error) {
          console.error(`Failed to unsubscribe from topic ${topic}:`, error);
        }
      });
    }
  }

  publish(topic: string, message: any, qos: 0 | 1 | 2 = 1): void {
    if (this.client && this.connected) {
      const payload = typeof message === 'string' ? message : JSON.stringify(message);
      this.client.publish(topic, payload, { qos }, (error) => {
        if (error) {
          console.error(`Failed to publish to topic ${topic}:`, error);
        }
      });
    }
  }

  getMessages(): Observable<MqttMessage> {
    return this.messageSubject.asObservable();
  }

  getConnectionStatus(): Observable<boolean> {
    return this.connectedSubject.asObservable();
  }

  isConnected(): boolean {
    return this.connected;
  }
}
```

### 3.3 Environment 設定

```typescript
// client/src/environments/environment.ts

export const environment = {
  production: false,
  apiUrl: 'http://localhost:8100/api',
  mqttBrokerHost: 'localhost',
  mqttBrokerWsPort: 8083,
  sensorUpdateInterval: 5000, // 5秒
};
```

---

## Phase 4: 測試用 MQTT Publisher

### 4.1 建立測試腳本

```python
# backend/scripts/mqtt_test_publisher.py

"""
MQTT 測試發布器
用於模擬感測器發送數據到 VerneMQ
"""

import paho.mqtt.client as mqtt
import json
import time
import random
from datetime import datetime

# 設定
MQTT_BROKER = "localhost"
MQTT_PORT = 1883

# 模擬的感測器
SENSORS = [
    {
        "sensor_id": "TEMP_001",
        "topic": "sensors/temperature/room_101",
        "type": "temperature",
        "unit": "°C",
        "min": 20.0,
        "max": 26.0
    },
    {
        "sensor_id": "HUMID_001",
        "topic": "sensors/humidity/room_101",
        "type": "humidity",
        "unit": "%",
        "min": 40.0,
        "max": 60.0
    },
    {
        "sensor_id": "CO2_001",
        "topic": "sensors/co2/room_101",
        "type": "co2",
        "unit": "ppm",
        "min": 400.0,
        "max": 1000.0
    },
]

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("Connected to MQTT Broker successfully")
    else:
        print(f"Failed to connect, return code {rc}")

def generate_sensor_data(sensor_config):
    """生成模擬感測器數據"""
    value = random.uniform(sensor_config["min"], sensor_config["max"])
    
    return {
        "value": round(value, 2),
        "timestamp": datetime.now().isoformat(),
        "sensor_id": sensor_config["sensor_id"],
        "type": sensor_config["type"],
        "unit": sensor_config["unit"]
    }

def main():
    # 建立 MQTT Client
    client = mqtt.Client(client_id="test_publisher")
    client.on_connect = on_connect
    
    # 連線
    print(f"Connecting to MQTT Broker at {MQTT_BROKER}:{MQTT_PORT}...")
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    client.loop_start()
    
    print("Starting to publish sensor data...")
    print("Press Ctrl+C to stop")
    
    try:
        while True:
            for sensor in SENSORS:
                data = generate_sensor_data(sensor)
                payload = json.dumps(data)
                
                result = client.publish(sensor["topic"], payload, qos=1)
                
                if result.rc == mqtt.MQTT_ERR_SUCCESS:
                    print(f"Published to {sensor['topic']}: {data['value']} {data['unit']}")
                else:
                    print(f"Failed to publish to {sensor['topic']}")
            
            time.sleep(5)  # 每5秒發送一次
            
    except KeyboardInterrupt:
        print("\nStopping publisher...")
        client.loop_stop()
        client.disconnect()
        print("Disconnected from MQTT Broker")

if __name__ == "__main__":
    main()
```

### 4.2 執行測試

```bash
# 安裝 paho-mqtt (如果還沒安裝)
pip install paho-mqtt

# 執行測試發布器
python backend/scripts/mqtt_test_publisher.py
```

---

## Phase 5: 建立範例感測器數據

### 5.1 Management Command

```python
# backend/sensors/management/commands/create_sample_sensors.py

from django.core.management.base import BaseCommand
from sensors.models import Sensor

class Command(BaseCommand):
    help = '建立範例感測器數據'

    def handle(self, *args, **options):
        sensors_data = [
            {
                'sensor_id': 'TEMP_001',
                'name': '會議室 101 溫度',
                'sensor_type': 'temperature',
                'unit': '°C',
                'mqtt_topic': 'sensors/temperature/room_101',
                'warning_threshold_min': 18.0,
                'warning_threshold_max': 28.0,
                'error_threshold_min': 15.0,
                'error_threshold_max': 32.0,
            },
            {
                'sensor_id': 'HUMID_001',
                'name': '會議室 101 濕度',
                'sensor_type': 'humidity',
                'unit': '%',
                'mqtt_topic': 'sensors/humidity/room_101',
                'warning_threshold_min': 30.0,
                'warning_threshold_max': 70.0,
            },
            {
                'sensor_id': 'CO2_001',
                'name': '會議室 101 CO2',
                'sensor_type': 'co2',
                'unit': 'ppm',
                'mqtt_topic': 'sensors/co2/room_101',
                'warning_threshold_max': 1000.0,
                'error_threshold_max': 1500.0,
            },
            {
                'sensor_id': 'POWER_001',
                'name': '空調主機功率',
                'sensor_type': 'power',
                'unit': 'kW',
                'mqtt_topic': 'sensors/power/hvac_main',
            },
        ]

        created_count = 0
        for sensor_data in sensors_data:
            sensor, created = Sensor.objects.get_or_create(
                sensor_id=sensor_data['sensor_id'],
                defaults=sensor_data
            )
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'Created sensor: {sensor.sensor_id}')
                )
            else:
                self.stdout.write(
                    self.style.WARNING(f'Sensor already exists: {sensor.sensor_id}')
                )

        self.stdout.write(
            self.style.SUCCESS(f'\nTotal sensors created: {created_count}')
        )
```

```bash
# 執行命令
python manage.py create_sample_sensors
```

---

## 開發檢查清單

### 基礎設定
- [ ] 更新 docker-compose.yml 加入 VerneMQ 和 Redis
- [ ] 建立必要的目錄結構
- [ ] 設定環境變數 (.env)
- [ ] 啟動所有服務並驗證

### Backend 開發
- [ ] 建立 sensors app
- [ ] 實作 Models (Sensor, SensorBimBinding, SensorDataLog)
- [ ] 執行 migrations
- [ ] 註冊 Django Admin
- [ ] 實作 MQTT Client
- [ ] 實作 Serializers
- [ ] 實作 ViewSets 和 API endpoints
- [ ] 設定 URL routing
- [ ] 建立範例數據

### Frontend 開發
- [ ] 建立 SensorService
- [ ] 建立 MqttWebsocketService
- [ ] 實作感測器管理頁面
- [ ] 實作 APS Viewer IoT 整合
- [ ] 實作即時數據更新
- [ ] 實作 IoT Markup Extension

### 測試
- [ ] VerneMQ 連線測試
- [ ] MQTT 發布/訂閱測試
- [ ] Backend API 測試
- [ ] Frontend 顯示測試
- [ ] 端對端整合測試

---

## 故障排除

### VerneMQ 連線問題
```bash
# 檢查 VerneMQ 是否正常運行
docker-compose ps vernemq

# 查看 VerneMQ 日誌
docker-compose logs -f vernemq

# 進入 VerneMQ 容器
docker-compose exec vernemq sh

# 檢查 VerneMQ 狀態
vernemq ping
```

### MQTT 連線測試
```bash
# 使用 mosquitto_sub 訂閱
mosquitto_sub -h localhost -p 1883 -t "sensors/#" -v

# 使用 mosquitto_pub 發布
mosquitto_pub -h localhost -p 1883 -t "sensors/test" -m '{"value": 25.5}'
```

### Redis 檢查
```bash
# 進入 Redis 容器
docker-compose exec redis redis-cli

# 查看所有 keys
KEYS sensor:*

# 查看特定 key
GET sensor:TEMP_001:latest
```

---

## 相關資源

- [VerneMQ Documentation](https://docs.vernemq.com/)
- [MQTT Protocol Specification](https://mqtt.org/)
- [Paho MQTT Python](https://www.eclipse.org/paho/index.php?page=clients/python/index.php)
- [Django REST Framework](https://www.django-rest-framework.org/)
- [Autodesk Forge Viewer](https://forge.autodesk.com/en/docs/viewer/v7/)

---

**最後更新**: 2025-12-11  
**專案負責人**: Jeffer  
**專案**: tx_bmms - Building Model Management System with IoT Integration

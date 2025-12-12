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

            # 如果有username和password，設定認證
            if settings.MQTT_BROKER_USERNAME and settings.MQTT_BROKER_PASSWORD:
                self.client.username_pw_set(
                    settings.MQTT_BROKER_USERNAME,
                    settings.MQTT_BROKER_PASSWORD
                )

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

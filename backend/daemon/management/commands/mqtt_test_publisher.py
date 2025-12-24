"""
MQTT 測試發布器 - Django Management Command
用於模擬感測器發送數據到 MQTT Broker (giantcld.com:1883)
"""

from django.core.management.base import BaseCommand
import paho.mqtt.client as mqtt
import json
import time
import random
from datetime import datetime
import sys
import signal


class Command(BaseCommand):
    help = 'MQTT Test Publisher - Simulate sensor data publishing to MQTT Broker'

    def add_arguments(self, parser):
        parser.add_argument(
            '--broker',
            type=str,
            default='giantcld.com',
            help='MQTT Broker hostname (default: giantcld.com)'
        )
        parser.add_argument(
            '--port',
            type=int,
            default=1883,
            help='MQTT Broker port (default: 1883)'
        )
        parser.add_argument(
            '--interval',
            type=int,
            default=1,
            help='Publish interval in seconds (default: 1)'
        )

    def __init__(self):
        super().__init__()
        self.client = None
        self.running = True

        # 模擬的感測器配置
        self.sensors = [
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
            {
                "sensor_id": "POWER_001",
                "topic": "sensors/power/hvac_main",
                "type": "power",
                "unit": "kW",
                "min": 5.0,
                "max": 15.0
            },
        ]

    def on_connect(self, client, userdata, flags, rc):
        """MQTT 連線回調"""
        if rc == 0:
            self.stdout.write(
                self.style.SUCCESS(f"✓ Connected to MQTT Broker at {userdata['broker']}:{userdata['port']}")
            )
        else:
            self.stdout.write(
                self.style.ERROR(f"✗ Failed to connect, return code {rc}")
            )
            sys.exit(1)

    def on_publish(self, client, userdata, mid):
        """發布訊息回調"""
        pass

    def generate_sensor_data(self, sensor_config):
        """生成模擬感測器數據"""
        value = random.uniform(sensor_config["min"], sensor_config["max"])

        return {
            "value": round(value, 2),
            "timestamp": datetime.now().isoformat(),
            "sensor_id": sensor_config["sensor_id"],
            "type": sensor_config["type"],
            "unit": sensor_config["unit"]
        }

    def signal_handler(self, signum, frame):
        """處理系統信號（優雅退出）"""
        self.stdout.write("\n" + "=" * 70)
        self.stdout.write(self.style.NOTICE("Received shutdown signal..."))
        self.stdout.write("=" * 70)
        self.running = False

    def handle(self, *args, **options):
        broker = options['broker']
        port = options['port']
        interval = options['interval']

        # 註冊信號處理器（用於 Docker/Supervisor 優雅關閉）
        signal.signal(signal.SIGTERM, self.signal_handler)
        signal.signal(signal.SIGINT, self.signal_handler)

        self.stdout.write("=" * 70)
        self.stdout.write(self.style.NOTICE("MQTT Test Publisher for tx_bmms IoT Sensors"))
        self.stdout.write("=" * 70)
        self.stdout.write(f"Target Broker: {broker}:{port}")
        self.stdout.write(f"Sensors: {len(self.sensors)}")
        self.stdout.write(f"Publish Interval: {interval} second(s)")
        self.stdout.write("-" * 70)

        # 建立 MQTT Client
        client_id = f"test_publisher_{int(time.time())}"
        self.client = mqtt.Client(client_id=client_id)
        self.client.user_data_set({"broker": broker, "port": port})
        self.client.on_connect = self.on_connect
        self.client.on_publish = self.on_publish

        try:
            # 連線
            self.stdout.write(f"Connecting to {broker}:{port}...")
            self.client.connect(broker, port, 60)
            self.client.loop_start()

            # 等待連線完成
            time.sleep(2)

            self.stdout.write("\n" + "=" * 70)
            self.stdout.write(self.style.SUCCESS("Starting to publish sensor data... (Press Ctrl+C to stop)"))
            self.stdout.write("=" * 70 + "\n")

            iteration = 0

            while self.running:
                iteration += 1
                timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                self.stdout.write(f"\n--- Iteration {iteration} ({timestamp}) ---")

                for sensor in self.sensors:
                    data = self.generate_sensor_data(sensor)
                    payload = json.dumps(data)

                    result = self.client.publish(sensor["topic"], payload, qos=1)

                    if result.rc == mqtt.MQTT_ERR_SUCCESS:
                        self.stdout.write(
                            f"  ✓ {sensor['sensor_id']:12s} → "
                            f"{data['value']:6.2f} {data['unit']:5s} "
                            f"(topic: {sensor['topic']})"
                        )
                    else:
                        self.stdout.write(
                            self.style.ERROR(f"  ✗ {sensor['sensor_id']:12s} → Failed to publish")
                        )

                # 等待指定的時間間隔
                time.sleep(interval)

        except KeyboardInterrupt:
            self.stdout.write("\n" + "=" * 70)
            self.stdout.write(self.style.NOTICE("Stopping publisher..."))
            self.stdout.write("=" * 70)

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"\n✗ Error: {e}"))
            sys.exit(1)

        finally:
            # 清理
            if self.client:
                self.client.loop_stop()
                self.client.disconnect()
                self.stdout.write(self.style.SUCCESS("✓ Disconnected from MQTT Broker"))

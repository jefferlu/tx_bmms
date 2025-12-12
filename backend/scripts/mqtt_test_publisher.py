#!/usr/bin/env python3
"""
MQTT 測試發布器
用於模擬感測器發送數據到 MQTT Broker (giantcld.com:1883)
"""

import paho.mqtt.client as mqtt
import json
import time
import random
from datetime import datetime
import sys

# MQTT Broker 設定
MQTT_BROKER = "giantcld.com"
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
    {
        "sensor_id": "POWER_001",
        "topic": "sensors/power/hvac_main",
        "type": "power",
        "unit": "kW",
        "min": 5.0,
        "max": 15.0
    },
]


def on_connect(client, userdata, flags, rc):
    """MQTT 連線回調"""
    if rc == 0:
        print(f"✓ Connected to MQTT Broker at {MQTT_BROKER}:{MQTT_PORT}")
    else:
        print(f"✗ Failed to connect, return code {rc}")
        sys.exit(1)


def on_publish(client, userdata, mid):
    """發布訊息回調"""
    pass


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
    """主函數"""
    print("=" * 70)
    print("MQTT Test Publisher for tx_bmms IoT Sensors")
    print("=" * 70)
    print(f"Target Broker: {MQTT_BROKER}:{MQTT_PORT}")
    print(f"Sensors: {len(SENSORS)}")
    print("-" * 70)

    # 建立 MQTT Client
    client = mqtt.Client(client_id=f"test_publisher_{int(time.time())}")
    client.on_connect = on_connect
    client.on_publish = on_publish

    # 連線
    try:
        print(f"Connecting to {MQTT_BROKER}:{MQTT_PORT}...")
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_start()

        # 等待連線完成
        time.sleep(2)

        print("\n" + "=" * 70)
        print("Starting to publish sensor data... (Press Ctrl+C to stop)")
        print("=" * 70 + "\n")

        iteration = 0

        while True:
            iteration += 1
            print(f"\n--- Iteration {iteration} ({datetime.now().strftime('%Y-%m-%d %H:%M:%S')}) ---")

            for sensor in SENSORS:
                data = generate_sensor_data(sensor)
                payload = json.dumps(data)

                result = client.publish(sensor["topic"], payload, qos=1)

                if result.rc == mqtt.MQTT_ERR_SUCCESS:
                    print(f"  ✓ {sensor['sensor_id']:12s} → {data['value']:6.2f} {data['unit']:5s} (topic: {sensor['topic']})")
                else:
                    print(f"  ✗ {sensor['sensor_id']:12s} → Failed to publish")

            time.sleep(5)  # 每5秒發送一次

    except KeyboardInterrupt:
        print("\n\n" + "=" * 70)
        print("Stopping publisher...")
        print("=" * 70)
        client.loop_stop()
        client.disconnect()
        print("✓ Disconnected from MQTT Broker")
        sys.exit(0)

    except Exception as e:
        print(f"\n✗ Error: {e}")
        client.loop_stop()
        client.disconnect()
        sys.exit(1)


if __name__ == "__main__":
    main()

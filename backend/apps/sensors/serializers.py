from rest_framework import serializers
from .models import Sensor, SensorBimBinding, SensorDataLog
import redis
import json
from django.conf import settings


class SensorSerializer(serializers.ModelSerializer):
    bim_bindings_count = serializers.SerializerMethodField()
    latest_value = serializers.SerializerMethodField()
    sensor_type_display = serializers.CharField(source='get_sensor_type_display', read_only=True)

    class Meta:
        model = Sensor
        fields = '__all__'

    def get_bim_bindings_count(self, obj):
        """取得綁定數量（OneToOneField 只會是 0 或 1）"""
        try:
            # 改用 OneToOneField 的 related_name (singular)
            binding = obj.bim_binding
            return 1 if binding and binding.is_active else 0
        except SensorBimBinding.DoesNotExist:
            return 0

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

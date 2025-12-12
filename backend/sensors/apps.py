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

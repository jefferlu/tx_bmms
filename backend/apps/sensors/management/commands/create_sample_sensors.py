from django.core.management.base import BaseCommand
from apps.sensors.models import Sensor


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

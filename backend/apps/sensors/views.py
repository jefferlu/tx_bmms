from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from datetime import timedelta
from django.db import transaction
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
        """取得特定感測器的綁定（一個 sensor 只能有一個綁定）"""
        sensor = self.get_object()
        try:
            # 改用 OneToOneField 的 related_name (singular)
            binding = sensor.bim_binding
            if binding.is_active:
                serializer = SensorBimBindingSerializer(binding)
                return Response(serializer.data)
            else:
                return Response(None)
        except SensorBimBinding.DoesNotExist:
            return Response(None)

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

    def create(self, request, *args, **kwargs):
        """創建綁定，如果 sensor 已有綁定則自動替換"""
        sensor_id = request.data.get('sensor')

        if not sensor_id:
            return Response(
                {'error': '缺少 sensor 參數'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 使用事務確保原子性操作
        with transaction.atomic():
            # 檢查該 sensor 是否已有綁定
            try:
                existing_binding = SensorBimBinding.objects.get(sensor_id=sensor_id)
                # 自動刪除舊綁定（因為 OneToOneField 只允許一個綁定）
                existing_binding.delete()
            except SensorBimBinding.DoesNotExist:
                # 沒有既有綁定，直接創建
                pass

            # 創建新綁定
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)

            headers = self.get_success_headers(serializer.data)
            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED,
                headers=headers
            )

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

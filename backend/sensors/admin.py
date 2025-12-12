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
        ('Modbus 設定', {
            'fields': ('modbus_address', 'modbus_register'),
            'classes': ('collapse',),
        }),
        ('API 設定', {
            'fields': ('api_endpoint', 'api_method'),
            'classes': ('collapse',),
        }),
        ('顯示設定', {
            'fields': ('display_format', 'decimal_places')
        }),
        ('告警閾值', {
            'fields': ('warning_threshold_min', 'warning_threshold_max',
                      'error_threshold_min', 'error_threshold_max')
        }),
        ('數據轉換', {
            'fields': ('data_transform',),
            'classes': ('collapse',),
        }),
        ('狀態', {
            'fields': ('is_active', 'last_seen', 'created_at', 'updated_at')
        }),
    )


@admin.register(SensorBimBinding)
class SensorBimBindingAdmin(admin.ModelAdmin):
    list_display = ['sensor', 'model_urn', 'element_dbid', 'element_name', 'position_type', 'is_active']
    list_filter = ['position_type', 'is_active', 'created_at']
    search_fields = ['sensor__sensor_id', 'sensor__name', 'element_name', 'model_urn']
    raw_id_fields = ['sensor']

    fieldsets = (
        ('感測器', {
            'fields': ('sensor',)
        }),
        ('BIM Element 識別', {
            'fields': ('model_urn', 'element_dbid', 'element_external_id', 'element_name')
        }),
        ('顯示位置', {
            'fields': ('position_type', 'position_offset')
        }),
        ('顯示樣式', {
            'fields': ('label_visible', 'icon_type', 'color')
        }),
        ('其他', {
            'fields': ('priority', 'notes', 'is_active')
        }),
    )


@admin.register(SensorDataLog)
class SensorDataLogAdmin(admin.ModelAdmin):
    list_display = ['sensor', 'value', 'status', 'timestamp']
    list_filter = ['status', 'timestamp']
    search_fields = ['sensor__sensor_id', 'sensor__name']
    date_hierarchy = 'timestamp'
    raw_id_fields = ['sensor']
    readonly_fields = ['sensor', 'value', 'raw_value', 'status', 'timestamp']

    def has_add_permission(self, request):
        # 防止手動新增數據日誌
        return False

    def has_change_permission(self, request, obj=None):
        # 數據日誌為只讀
        return False

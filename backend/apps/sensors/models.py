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

    # 將 sensor 改為 OneToOneField，確保一對一關係
    sensor = models.OneToOneField('Sensor',on_delete=models.CASCADE,related_name='bim_binding',verbose_name='感測器',
        unique=True  # 確保唯一性
    )

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

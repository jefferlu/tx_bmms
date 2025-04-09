from django.db import models


class ZoneCode(models.Model):
    code = models.CharField(max_length=10, unique=True)
    description = models.CharField(max_length=255)

    class Meta:
        db_table = "forge_zone_code"

    def __str__(self):
        return f"{self.code} - {self.description}"


class LevelCode(models.Model):
    code = models.CharField(max_length=10, unique=True)  # 例如 "XX"
    description = models.CharField(max_length=255)       # 樓層描述，例如 "Ground Floor" 或 "B1"

    class Meta:
        db_table = "forge_level_code"

    def __str__(self):
        return f"{self.code} - {self.description}"


class BimModel(models.Model):
    name = models.CharField(max_length=255)  # 對應檔案名稱
    urn = models.CharField(max_length=255)
    version = models.IntegerField()
    zone_code = models.ForeignKey(ZoneCode, on_delete=models.RESTRICT,  related_name="bim_models")
    level_code = models.ForeignKey(LevelCode, on_delete=models.RESTRICT, related_name="bim_models_level")
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "forge_bim_model"
        ordering = ["id"]
        indexes = [
            models.Index(fields=['name']),
        ]

    def __str__(self):
        return self.name


class BimGroupType(models.Model):
    display_name = models.CharField(max_length=255)  # 對應 SQLite 的 attrs.display_name
    value = models.CharField(max_length=255, null=True, blank=True)
    description = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "forge_bim_type"
        indexes = [
            models.Index(fields=['display_name']),
            models.Index(fields=['value']),
        ]

    def __str__(self):
        return self.display_name


class BimGroup(models.Model):
    name = models.CharField(max_length=255, unique=True)  # 對應 SQLite 的 attrs.name
    is_active = models.BooleanField(default=True)
    types = models.ManyToManyField(BimGroupType, blank=True, related_name='bim_groups')
    description = models.TextField(null=True, blank=True)
    order = models.IntegerField(default=1)

    class Meta:
        db_table = "forge_bim_group"
        ordering = ["id"]
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['order']),
        ]

    def __str__(self):
        return self.name


class BimCategory(models.Model):
    bim_group = models.ForeignKey(BimGroup, on_delete=models.CASCADE, related_name='bim_categories')
    bim_model = models.ForeignKey(BimModel, on_delete=models.CASCADE, related_name='bim_categories')
    value = models.CharField(max_length=255)  # 對應 SQLite 的 vals.value
    is_active = models.BooleanField(default=True)
    display_name = models.TextField(null=True, blank=True)  # 對應 SQLite 的 attrs.display_name

    class Meta:
        db_table = "forge_bim_category"
        verbose_name_plural = 'Bim categories'
        ordering = ["id"]
        unique_together = ('bim_model', 'bim_group', 'value')
        indexes = [
            models.Index(fields=['bim_group']),
            models.Index(fields=['value']),
        ]

    def __str__(self):
        return self.value


class BimObject(models.Model):
    category = models.ForeignKey('BimCategory', on_delete=models.CASCADE, related_name="bim_objects")
    dbid = models.IntegerField()
    primary_value = models.CharField(max_length=255)  # 儲存主要值，(__name__)
    display_name = models.CharField(max_length=255)
    value = models.CharField(max_length=255)

    class Meta:
        db_table = "forge_bim_object"
        indexes = [
            models.Index(fields=['category']),
            models.Index(fields=['dbid']),
            models.Index(fields=['dbid', 'category']),  # 新增聯合索引
        ]

    def __str__(self):
        return f"{self.value} (dbid: {self.dbid})"

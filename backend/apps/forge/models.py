from django.db import models


class BimGroupType(models.Model):
    display_name = models.CharField(max_length=255)  # 對應 SQLite 的 attrs.display_name
    value = models.CharField(max_length=255, null=True, blank=True)
    description = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "forge_bim_group_type"
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
    bim_group = models.ForeignKey(BimGroup, on_delete=models.CASCADE, related_name='bim_categories', null=True, blank=True)
    value = models.CharField(max_length=255)  # 對應 SQLite 的 vals.value
    is_active = models.BooleanField(default=True)
    display_name = models.TextField(null=True, blank=True)  # 對應 SQLite 的 attrs.display_name

    class Meta:
        db_table = "forge_bim_category"
        verbose_name_plural = 'Bim categories'
        ordering = ["id"]
        indexes = [
            models.Index(fields=['bim_group']),
            models.Index(fields=['value']),
        ]

    def __str__(self):
        return self.value


class BimModel(models.Model):
    name = models.CharField(max_length=255)  # 對應檔案名稱
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "forge_bim_model"
        ordering = ["id"]
        indexes = [
            models.Index(fields=['name']),
        ]

    def __str__(self):
        return self.name


class BimConversion(models.Model):
    bim_model = models.ForeignKey(BimModel, on_delete=models.CASCADE, related_name="bim_conversions")
    urn = models.CharField(max_length=255)
    version = models.IntegerField()
    original_file = models.CharField(max_length=500)
    svf_file = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('bim_model', 'version')
        db_table = "forge_bim_conversion"
        ordering = ["id"]
        indexes = [
            models.Index(fields=['bim_model']),
            models.Index(fields=['version']),
            models.Index(fields=['urn']),
            models.Index(fields=['bim_model', 'version']),  # 新增聯合索引
        ]

    def __str__(self):
        return f"{self.bim_model.name} - v{self.version}"


class BimObject(models.Model):
    category = models.ForeignKey('BimCategory', on_delete=models.CASCADE, related_name="bim_objects")
    conversion = models.ForeignKey('BimConversion', on_delete=models.CASCADE, related_name="bim_objects")
    dbid = models.IntegerField()
    value = models.CharField(max_length=255)  # 對應 SQLite 的 vals.value (即 name)

    class Meta:
        db_table = "forge_bim_object"
        indexes = [
            models.Index(fields=['category']),
            models.Index(fields=['conversion']),
        ]

    def __str__(self):
        return f"{self.value} (dbid: {self.dbid})"

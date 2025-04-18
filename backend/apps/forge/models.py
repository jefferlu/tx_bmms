from django.db import models
from mptt.models import MPTTModel, TreeForeignKey


class ZoneCode(models.Model):
    code = models.CharField(max_length=10, unique=True)
    description = models.CharField(max_length=255)

    class Meta:
        db_table = "forge_zone_code"
        indexes = [models.Index(fields=['code'])]

    def __str__(self):
        return f"{self.code} - {self.description}"


class LevelCode(models.Model):
    code = models.CharField(max_length=10, unique=True)
    description = models.CharField(max_length=255)

    class Meta:
        db_table = "forge_level_code"
        indexes = [models.Index(fields=['code'])]

    def __str__(self):
        return f"{self.code} - {self.description}"


class BimModel(models.Model):
    name = models.CharField(max_length=255)
    urn = models.CharField(max_length=255)
    version = models.IntegerField()
    zone_code = models.ForeignKey(ZoneCode, on_delete=models.RESTRICT, related_name="bim_models")
    level_code = models.ForeignKey(LevelCode, on_delete=models.RESTRICT, related_name="bim_models_level")
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_processed_version = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = "forge_bim_model"
        ordering = ["id"]
        indexes = [
            models.Index(fields=['name']),
        ]

    def __str__(self):
        return self.name


class BimCondition(MPTTModel):
    name = models.CharField(max_length=255)
    display_name = models.CharField(max_length=255, null=True, blank=True)
    value = models.CharField(max_length=255, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    order = models.IntegerField(default=1)
    parent = TreeForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')

    class Meta:
        db_table = "forge_bim_condition"
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['display_name']),
            models.Index(fields=['value']),
            models.Index(fields=['order']),
            models.Index(fields=['parent_id']),
        ]

    class MPTTMeta:
        order_insertion_by = ['order']

    def __str__(self):
        return self.name


class BimCategory(models.Model):
    condition = models.ForeignKey(BimCondition, on_delete=models.CASCADE, related_name='bim_categories')
    value = models.CharField(max_length=255)
    display_name = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "forge_bim_category"
        verbose_name_plural = 'Bim categories'
        ordering = ["id"]
        unique_together = ('condition', 'value')
        indexes = [
            models.Index(fields=['condition']),
            models.Index(fields=['value']),
        ]

    def __str__(self):
        return self.value


class BimObject(models.Model):
    bim_model = models.ForeignKey(BimModel, on_delete=models.CASCADE, related_name='bim_objects')
    dbid = models.IntegerField()
    display_name = models.CharField(max_length=255)
    value = models.CharField(max_length=255)

    class Meta:
        db_table = "forge_bim_object"
        indexes = [
            models.Index(fields=['bim_model']),
            models.Index(fields=['dbid']),
            models.Index(fields=['display_name']),
            models.Index(fields=['value']),
        ]

    def __str__(self):
        return f"{self.value} (dbid: {self.dbid})"
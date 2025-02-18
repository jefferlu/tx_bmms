from django.db import models
from mptt.models import MPTTModel, TreeForeignKey


class BimGroup(models.Model):
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(null=True, blank=True)
    order = models.IntegerField(default=1)

    class Meta:
        db_table = "forge_bim_group"
        ordering = ["id"]

    def __str__(self):
        return self.name


class BimCategory(models.Model):
    bim_group = models.ForeignKey(BimGroup, on_delete=models.CASCADE,
                                  related_name='bim_category', null=True, blank=True)
    name = models.CharField(max_length=255, unique=True)
    is_active = models.BooleanField(default=True)
    description = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "forge_bim_category"
        verbose_name_plural = 'Bim categories'
        ordering = ["id"]

    def __str__(self):
        return self.name


class BimModel(models.Model):
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "forge_bim_model"
        ordering = ["id"]

    def __str__(self):
        return self.name


class BimConversion(models.Model):
    bim_model = models.ForeignKey(BimModel, on_delete=models.CASCADE, related_name="bim_conversions")
    urn = models.CharField(max_length=255)
    version = models.IntegerField()  # 轉換版本號，需自行設定
    original_file = models.CharField(max_length=500)
    svf_file = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('bim_model', 'version')
        db_table = "forge_bim_conversion"
        ordering = ["id"]


class BimProperty(models.Model):    
    category = models.ForeignKey(BimCategory, on_delete=models.CASCADE, related_name="bim_property")
    conversion = models.ForeignKey(BimConversion, on_delete=models.CASCADE, related_name="bim_property")    
    dbid = models.IntegerField()
    key = models.CharField(max_length=255)
    value = models.TextField()

    class Meta:
        db_table = "forge_bim_property"

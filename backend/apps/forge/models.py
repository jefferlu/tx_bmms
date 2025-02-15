from django.db import models
from mptt.models import MPTTModel, TreeForeignKey


class Tender(MPTTModel):
    name = models.CharField(max_length=255, unique=True)
    parent = TreeForeignKey('self', on_delete=models.CASCADE,
                            null=True, blank=True, related_name='children')

    def __str__(self):
        return f"{self.name}"


class BimModel(models.Model):
    tender = models.ForeignKey(Tender, on_delete=models.CASCADE, related_name="bim_models")
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "forge_bim_model"


class BimConversion(models.Model):

    bim_model = models.ForeignKey(BimModel, on_delete=models.CASCADE, related_name="conversions")
    urn = models.CharField(max_length=255)
    version = models.IntegerField()  # 轉換版本號，需手動設定
    original_file = models.CharField(max_length=500)
    svf_file = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('bim_model', 'version')  # 確保同一個 BIMModel 不會有重複的版本號
        db_table = "forge_bim_conversion"


class BimCategory(models.Model):
    name = models.CharField(max_length=255, unique=True)  # 類別名稱
    description = models.TextField(null=True, blank=True)  # 類別描述（可選）

    class Meta:
        db_table = "forge_bim_category"
        verbose_name_plural = 'Categories'

    def __str__(self):
        return self.name


# class BIMObject(models.Model):
#     """ 記錄 BIM 物件資訊（例如：門、窗、牆） """
#     bim_conversion = models.ForeignKey(BIMConversion, on_delete=models.CASCADE, related_name="bim_objects")
#     object_id = models.CharField(max_length=255, unique=True)  # 物件唯一 ID（來自 APS）
#     name = models.CharField(max_length=255)
#     category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="bim_objects")  # 使用外鍵參照 Category


# class BIMProperty(models.Model):
#     """ 記錄 BIM 物件的屬性（長度、材質、成本等） """
#     bim_object = models.ForeignKey(BIMObject, on_delete=models.CASCADE, related_name="properties")
#     key = models.CharField(max_length=255)
#     value = models.TextField()

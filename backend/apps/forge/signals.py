from django.db.models.signals import post_save
from django.dispatch import receiver

from . import models


def assign_default_bim_group(sender, instance, created, **kwargs):
    """當 BimCategory 創建且未指定 bim_group 時，自動填入 BimGroup 最小 ID"""
    if created and instance.bim_group is None:  # 只在新建時執行
        min_bim_group = models.BimGroup.objects.order_by("id").first()  # 取得最小 ID 的 BimGroup
        if min_bim_group:
            instance.bim_group = min_bim_group
            instance.save(update_fields=['bim_group'])  # 只更新 bim_group 欄位            

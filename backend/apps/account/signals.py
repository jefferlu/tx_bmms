from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from apps.core import models

User = get_user_model()


# @receiver(post_save, sender=User)
# def create_user_profile(sender, instance, created, **kwargs):

#     # 提取 email domain
#     domain = instance.email.split('@')[-1]

#     # 根據 domain 查找或創建 Company
#     company, _ = models.Company.objects.get_or_create(name=domain)
#     models.UserProfile.objects.get_or_create(user=instance, defaults={'company': company})

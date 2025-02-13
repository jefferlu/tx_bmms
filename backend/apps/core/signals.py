from django.db.models.signals import post_save
from django.dispatch import receiver

from . import models


# @receiver(post_save, sender=models.AutodeskCredentials)
# def create_creditials(sender, instance, **kwargs):
#     if isinstance(instance._client_secret, str):
#         instance.company = 1
#         instance.set_client_secret(instance._client_secret)

@receiver(post_save, sender=models.Company)
def create_aps_credentials(sender, instance, created, **kwargs):
    if created:
        models.ApsCredentials.objects.create(
            company=instance,
            client_id="your_client_id",  # 預設值
            client_secret="your_client_secret",  # 預設值
        )

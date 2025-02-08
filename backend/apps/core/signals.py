from django.db.models.signals import post_save
from django.dispatch import receiver

from . import models


# @receiver(post_save, sender=models.AutodeskCredentials)
# def create_creditials(sender, instance, **kwargs):
#     print('-->create_creditials')
#     if isinstance(instance._client_secret, str):
#         instance.set_client_secret(instance._client_secret)

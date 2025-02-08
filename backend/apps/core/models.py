from django.db import models
from django.conf import settings
from django.contrib.auth.models import Permission, Group
from mptt.models import MPTTModel, TreeForeignKey
from cryptography.fernet import Fernet

# 公司別


class Company(models.Model):
    name = models.CharField(max_length=255, unique=True)  # verbose_name="名稱"

    class Meta:
        verbose_name_plural = 'Companies'

    def __str__(self):
        return self.name


# 用戶資料
class UserProfile(models.Model):
    user = models.OneToOneField(
        to='account.User', on_delete=models.CASCADE, related_name='user_profile')
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name='user_profile')

    def __str__(self):
        return f"{self.user.username} - {self.company.name}"

    # 刪除UserProfile時，關聯刪除User
    def delete(self, *args, **kwargs):
        self.user.delete()  # 刪除 User
        super().delete(*args, **kwargs)  # 刪除 UserProfile 本身


class Navigation(MPTTModel):
    TYPE_CHOICES = [
        ('aside', 'aside'),
        ('basic', 'basic'),
        ('collapsable', 'collapsable'),
        ('divider', 'divider'),
        ('group', 'group'),
        ('spacer', 'spacer'),
    ]

    title_locale = models.CharField(max_length=30)
    subtitle_locale = models.CharField(max_length=255, blank=True, null=True)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    icon = models.CharField(max_length=120, blank=True, null=True)
    link = models.CharField(max_length=255, blank=True, null=True)
    permissions = models.ManyToManyField(Permission, blank=True)
    parent = TreeForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')
    is_active = models.BooleanField(default=True)
    order = models.IntegerField(default=0)

    class Meta:
        verbose_name_plural = 'Navigations'
        default_permissions = []  # 不生成預設權限
        permissions = []

    class MPTTMeta:
        order_insertion_by = ['order']

    def __str__(self):
        return self.title_locale


class Locale(models.Model):
    lang = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.lang} - {self.name}"


class Translation(models.Model):
    locale = models.ForeignKey(Locale, on_delete=models.CASCADE)  # 改用 ForeignKey
    key = models.CharField(max_length=255)
    value = models.TextField()

    class Meta:
        unique_together = ('key', 'locale',)

    def __str__(self):
        return f"{self.locale.lang} - {self.key}"


class AutodeskCredentials(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="autodesk_credentials")
    client_id = models.CharField(max_length=255)
    client_secret = models.CharField(max_length=255)
    bucket_key = models.CharField(max_length=255, unique=True)  # 新增 Bucket Key

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Autodesk Credentials ({self.client_id})"

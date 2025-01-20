from django.db import models
from mptt.models import MPTTModel, TreeForeignKey
from django.contrib.auth.models import Permission

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

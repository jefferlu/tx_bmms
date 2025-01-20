from django.contrib import admin
from django.contrib.contenttypes.models import ContentType
from django.contrib.auth.models import Permission, Group
from django.db.models import Q
from mptt.admin import MPTTModelAdmin

from . import models


@admin.register(models.Navigation)
class NavigationAdmin(MPTTModelAdmin):
    list_display = ('title_locale', 'subtitle_locale', 'type', 'icon', 'link',
                    'parent', 'order', 'is_active', )
    filter_horizontal = ('permissions',)
    mptt_level_indent = 20

    def get_queryset(self, request):
        models.Navigation.objects.rebuild()  # 確保樹結構依model之order_insertion_by排序重新生成
        qs = super().get_queryset(request)
        return qs

    def formfield_for_manytomany(self, db_field, request, **kwargs):
        if db_field.name == "permissions":
            kwargs["queryset"] = Permission.objects.filter(
                Q(content_type__app_label='core') & Q(content_type__model='navigation'))  # 限定可設定之權限
        return super().formfield_for_manytomany(db_field, request, **kwargs)

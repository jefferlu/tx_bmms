import base64

from django.contrib import admin
from django.contrib.contenttypes.models import ContentType
from django.contrib.auth.models import Permission, Group
from django.db.models import Q
from django import forms

from mptt.admin import MPTTModelAdmin

from . import models


@admin.register(models.Company)
class CommpanyAdmin(admin.ModelAdmin):
    list_display = ('id', 'name',)


@admin.register(models.UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'company',)


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


@admin.register(models.Locale)
class LocaleAdmin(admin.ModelAdmin):
    list_display = ('lang', 'name', 'is_active',)


@admin.register(models.Translation)
class TranslationAdmin(admin.ModelAdmin):
    list_display = ('locale__name', 'locale__lang', 'key',  'value', )
    list_filter = ('locale',)
    search_fields = ('key', 'value')


@admin.register(models.AutodeskCredentials)
class AutodeskCredentialsAdmin(admin.ModelAdmin):
    list_display = ('client_id', 'client_secret', 'created_at', 'updated_at',)


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ('codename', 'name', )

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        # qs = qs.filter(content_type__app_label='core', content_type__model='navigation')
        qs = qs.filter(Q(content_type__app_label='core') &
                       Q(content_type__model='navigation')).order_by('codename')
        return qs

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "content_type":
            # 只顯示特定應用的 ContentType
            kwargs["queryset"] = ContentType.objects.filter(
                app_label='core', model='navigation')
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


admin.site.unregister(Group)  # 取消 Django 預設的註冊


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)
    filter_horizontal = ('permissions',)

    def get_queryset(self, request):
        qs = super().get_queryset(request).order_by('id')
        return qs

    def formfield_for_manytomany(self, db_field, request, **kwargs):
        if db_field.name == "permissions":
            kwargs["queryset"] = Permission.objects.filter(
                Q(content_type__app_label='core') & Q(content_type__model='navigation'))  # 限定可設定之權限
        return super().formfield_for_manytomany(db_field, request, **kwargs)

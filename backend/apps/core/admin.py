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


class AutodeskCredentialsAdminForm(forms.ModelForm):
    """ 自訂表單，允許輸入 client_secret """
    client_secret_input = forms.CharField(
        label="Client Secret",
        widget=forms.PasswordInput(
            attrs={"style": "width: 260px;"},
            render_value=True
        ),  # 顯示密碼輸入框
        required=True
    )

    class Meta:
        model = models.AutodeskCredentials
        fields = ['company', 'bucket_key', 'client_id', ]  # **不要放 `client_secret`**
        # fields = '__all__'

    def save(self, commit=True):
        """ 儲存時自動加密 `client_secret` """
        instance = super().save(commit=False)

        # 檢查使用者是否輸入了新的 `client_secret`
        client_secret_value = self.cleaned_data.get('client_secret_input')
        if client_secret_value:
            instance.set_client_secret(client_secret_value)  # 加密並儲存

        if commit:
            instance.save()
        return instance


@admin.register(models.AutodeskCredentials)
class AutodeskCredentialsAdmin(admin.ModelAdmin):
    form = AutodeskCredentialsAdminForm
    list_display = ('client_id', 'get_client_secret_display', 'created_at', 'updated_at')

    def get_client_secret_display(self, obj):
        """避免顯示完整密碼"""
        secret = obj.get_client_secret()
        return secret[:10] + "..." if secret else "N/A"
    get_client_secret_display.short_description = 'Client Secret'

    # def save_model(self, request, obj, form, change):
    #     """儲存加密後的密碼"""
    #     if 'client_secret' in form.cleaned_data and form.cleaned_data['client_secret']:
    #         obj.set_client_secret(form.cleaned_data['client_secret'])  # 加密後存入
    #     super().save_model(request, obj, form, change)


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

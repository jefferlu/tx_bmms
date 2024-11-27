from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import Permission
from django.db.models import Q
from django.utils.translation import gettext_lazy as _

from .forms import CustomUserCreationForm, CustomUserChangeForm
from . import models


@admin.register(models.User)
class CustomUserAdmin(UserAdmin):
    add_form = CustomUserCreationForm
    form = CustomUserChangeForm
    model = models.User
    list_display = ('email', 'username', 'first_name', 'is_staff',
                    'is_active', 'is_superuser',  'last_login', 'date_joined', )
    # list_filter = ('username', 'email', 'is_staff', 'is_active',)
    # search_fields = ('username',)
    ordering = ('id',)

    # 定義在編輯使用者時顯示的字段
    fieldsets = (
        # *UserAdmin.fieldsets,
        (None, {'fields': ('username', 'password', 'is_staff', 'is_active', 'is_superuser', 'user_permissions',)}),

        # (_('Personal info'), {'fields': ('first_name', 'email',)}),
        # (_('Permissions'), {
        #  'fields': ('is_staff', 'is_active', 'is_superuser',)}),
        # (_('Important dates'),
        #  {'fields': ('last_login', 'date_joined',)}),
    )

    # 定義在建立使用者時顯示的字段
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'username', 'password1', 'password2',   'is_staff', 'is_active', 'is_superuser', 'user_permissions',)}
         ),
    )
    
    def formfield_for_manytomany(self, db_field, request, **kwargs):
        if db_field.name == "user_permissions":
            kwargs["queryset"] = Permission.objects.filter(
                Q(content_type__app_label='core') & Q(content_type__model='navigation'))
        return super().formfield_for_manytomany(db_field, request, **kwargs)

    
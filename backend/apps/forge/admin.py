from django.contrib import admin
from . import models


@admin.register(models.BimGroup)
class BimGroupAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'description', 'order', )


@admin.register(models.BimCategory)
class BimCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'bim_group', 'is_active', 'description', )


@admin.register(models.BimModel)
class BimModelAdmin(admin.ModelAdmin):
    list_display = ('name', 'created_at')


@admin.register(models.BimConversion)
class BimConversionAdmin(admin.ModelAdmin):
    list_display = ('bim_model', 'urn', 'version', 'original_file', 'svf_file', 'created_at',)


@admin.register(models.BimProperty)
class BimPropertyAdmin(admin.ModelAdmin):
    list_display = ('category', 'conversion', 'dbid', 'key', 'value',)

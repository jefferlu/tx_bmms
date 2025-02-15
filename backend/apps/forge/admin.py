from django.contrib import admin
from . import models


@admin.register(models.BimCategory)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'description')


@admin.register(models.BimModel)
class BIMModelAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'created_at')


@admin.register(models.BimConversion)
class BIMConversionAdmin(admin.ModelAdmin):
    list_display = ('id', 'bim_model', 'urn', 'version', 'original_file', 'svf_file', 'created_at',)

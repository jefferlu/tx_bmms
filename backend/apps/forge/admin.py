from django.contrib import admin
from . import models


@admin.register(models.Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'description')


@admin.register(models.BIMModel)
class BIMModelAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'created_at')


@admin.register(models.BIMConversion)
class BIMConversionAdmin(admin.ModelAdmin):
    list_display = ('id', 'bim_model', 'urn', 'version', 'original_file', 'svf_file', 'created_at',)

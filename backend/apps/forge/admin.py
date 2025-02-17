from django.contrib import admin
from . import models


# @admin.register(models.BimTender)
# class BimTenderAdmin(admin.ModelAdmin):
#     list_display = ('id', 'name', 'parent',)


@admin.register(models.BimModel)
class BimModelAdmin(admin.ModelAdmin):
    list_display = ('name', 'created_at')


@admin.register(models.BimConversion)
class BimConversionAdmin(admin.ModelAdmin):
    list_display = ('bim_model', 'urn', 'version', 'original_file', 'svf_file', 'created_at',)


@admin.register(models.BimGroup)
class BimCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'description', 'order', )


@admin.register(models.BimCategory)
class BimCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'bim_group', 'is_active', 'description', )

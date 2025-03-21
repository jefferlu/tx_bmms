from django.contrib import admin
from . import models


@admin.register(models.BimGroup)
class BimGroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'cobie', 'typess', 'is_active', 'description', 'order', )
    filter_horizontal = ('types',)

    def typess(self, obj):
        return ", ".join([c.name for c in obj.types.all()])


@admin.register(models.BimGroupType)
class BimGroupTypeAdmin(admin.ModelAdmin):
    list_display = ('name', 'description', )


@admin.register(models.BimCategory)
class BimCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'bim_group', 'is_active', 'description', 'id', )


@admin.register(models.BimModel)
class BimModelAdmin(admin.ModelAdmin):
    list_display = ('name', 'created_at')


@admin.register(models.BimConversion)
class BimConversionAdmin(admin.ModelAdmin):
    list_display = ('bim_model', 'urn', 'version', 'original_file', 'svf_file', 'created_at',)


@admin.register(models.BimProperty)
class BimPropertyAdmin(admin.ModelAdmin):
    list_display = ('category', 'conversion', 'dbid', 'key', 'value',)

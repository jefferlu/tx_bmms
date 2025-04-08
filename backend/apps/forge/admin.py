from django.contrib import admin
from . import models


@admin.register(models.BimGroup)
class BimGroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'typess', 'is_active', 'description', 'order', )
    filter_horizontal = ('types',)

    def typess(self, obj):
        return ", ".join([c.display_name for c in obj.types.all()])


@admin.register(models.BimGroupType)
class BimGroupTypeAdmin(admin.ModelAdmin):
    list_display = ('display_name', 'value', 'description', )


@admin.register(models.BimCategory)
class BimCategoryAdmin(admin.ModelAdmin):
    list_display = ('value', 'bim_group', 'is_active', 'display_name', 'id', )
    search_fields = ('display_name', 'value')


@admin.register(models.BimModel)
class BimModelAdmin(admin.ModelAdmin):
    list_display = ('name', 'created_at', )


# @admin.register(models.BimConversion)
# class BimConversionAdmin(admin.ModelAdmin):
#     list_display = ('bim_model', 'urn', 'version', 'original_file', 'svf_file', 'created_at', )


@admin.register(models.BimObject)
class BimObjectAdmin(admin.ModelAdmin):
    list_display = ('category', 'dbid', 'value',)

from django.contrib import admin
from mptt.admin import MPTTModelAdmin
from . import models


@admin.register(models.ZoneCode)
class ZoneCodeAdmin(admin.ModelAdmin):
    list_display = ('code', 'description',)


@admin.register(models.BimCondition)
class BimConditionAdmin(MPTTModelAdmin):
    list_display = ('name', 'display_name', 'value', 'description', 'parent', 'order', 'is_active', )
    mptt_level_indent = 20

    def get_queryset(self, request):
        models.BimCondition.objects.rebuild()  # 確保樹結構依model之order_insertion_by排序重新生成
        qs = super().get_queryset(request)
        return qs


@admin.register(models.BimCategory)
class BimCategoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'bim_model', 'condition', 'display_name', 'value', )


@admin.register(models.BimRegion)
class BimRegionAdmin(admin.ModelAdmin):
    list_display = ('bim_model', 'zone',  'level', 'value', 'dbid',)


@admin.register(models.BimModel)
class BimModelAdmin(admin.ModelAdmin):
    list_display = ('name', 'urn',  'version', 'svf_path', 'created_at', 'updated_at', 'last_processed_version',)


@admin.register(models.BimObject)
class BimObjectAdmin(admin.ModelAdmin):
    list_display = ('bim_model', 'dbid', 'display_name', 'value',)
    search_fields = ('display_name', 'value')

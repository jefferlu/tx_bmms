from rest_framework import serializers

from ..services import get_tender_name
from .. import models


class ObjectSerializer(serializers.Serializer):
    name = serializers.CharField(source='objectKey')
    bucketKey = serializers.CharField()
    objectId = serializers.CharField()
    sha1 = serializers.CharField()
    size = serializers.IntegerField()
    location = serializers.CharField()
    is_oss = serializers.SerializerMethodField()

    def get_is_oss(self, obj):
        return True


class BimConversionSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.BimConversion
        fields = ['urn', 'version', 'original_file', 'svf_file', 'created_at']


class BimModelSerializer(serializers.ModelSerializer):
    urn = serializers.CharField(source='latest_urn', allow_null=True)
    version = serializers.IntegerField(source='latest_version', allow_null=True)
    original_file = serializers.CharField(source='latest_original_file', allow_null=True)
    svf_file = serializers.CharField(source='latest_svf_file', allow_null=True)
    conversion_created_at = serializers.DateTimeField(source='latest_conversion_created_at', allow_null=True)
    tender = serializers.SerializerMethodField()

    class Meta:
        model = models.BimModel
        fields = ['id', 'tender', 'name', 'created_at', 'urn', 'version',
                  'original_file', 'svf_file', 'conversion_created_at']

    def get_tender(self, obj):
        return get_tender_name(obj.name)


class BimCategorySerializer(serializers.ModelSerializer):
    conversion = BimConversionSerializer(read_only=True)  # 新增 conversion 欄位

    class Meta:
        model = models.BimCategory
        fields = ['id', 'value', 'display_name', 'bim_group', 'conversion']  # 添加 conversion

    def to_representation(self, instance):
        # 根據 context['fields'] 來動態選擇需要回傳的欄位
        fields = self.context.get('fields', self.Meta.fields)
        data = super().to_representation(instance)
        return {key: value for key, value in data.items() if key in fields}


class BimGroupSerializer(serializers.ModelSerializer):
    bim_categories = BimCategorySerializer(many=True, read_only=True)

    class Meta:
        model = models.BimGroup
        fields = ['id', 'name', 'description', 'order', 'bim_categories']

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if not representation.get('bim_categories'):
            return None
        return representation


class BimObjectAttributeSerializer(serializers.ModelSerializer):
    group_name = serializers.ReadOnlyField(source='category.bim_group.name')
    category = serializers.ReadOnlyField(source='category.value')
    value = serializers.ReadOnlyField()

    class Meta:
        model = models.BimObject
        fields = ['group_name', 'category', 'value']


class BimObjectSerializer(serializers.Serializer):  # 改為 Serializer，因為不再直接綁定 Model
    id = serializers.IntegerField(source='dbid')  # 使用 dbid 作為 id
    dbid = serializers.IntegerField()
    primary_value = serializers.CharField()
    model_name = serializers.CharField(source='category__conversion__bim_model__name')
    version = serializers.IntegerField(source='category__conversion__version')
    urn = serializers.CharField(source='category__conversion__urn')
    attributes = serializers.JSONField()

    class Meta:
        fields = ['id', 'dbid', 'model_name', 'primary_value', 'version', 'urn', 'attributes']


class BimModelWithCategoriesSerializer(serializers.ModelSerializer):
    categories = serializers.SerializerMethodField()
    tender = serializers.SerializerMethodField()

    class Meta:
        model = models.BimModel
        fields = ['id', 'tender', 'name', 'categories']

    def get_tender(self, obj):
        return get_tender_name(obj.name)

    def get_categories(self, obj):
        if obj.bim_conversions.exists():
            latest_conversion = sorted(obj.bim_conversions.all(), key=lambda x: x.version, reverse=True)[0]
            return BimCategorySerializer(
                latest_conversion.active_categories,
                many=True,
                context={'fields': ['id']}
            ).data
        return []

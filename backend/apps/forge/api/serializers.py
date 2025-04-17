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


# class BimConversionSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = models.BimConversion
#         fields = ['urn', 'version', 'original_file', 'svf_file', 'created_at']


class BimModelSerializer(serializers.ModelSerializer):
    tender = serializers.SerializerMethodField()

    class Meta:
        model = models.BimModel
        fields = ['id', 'tender', 'name', 'urn', 'version', 'created_at', 'updated_at']

    def get_tender(self, obj):
        return get_tender_name(obj.name)


class BimCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = models.BimCategory
        fields = ['id', 'value', 'display_name', 'bim_group']

    def to_representation(self, instance):
        fields = self.context.get('fields', self.Meta.fields)
        data = super().to_representation(instance)
        return {key: value for key, value in data.items() if key in fields}

# class BimGroupSerializer(serializers.ModelSerializer):
#     bim_categories = BimCategorySerializer(many=True, read_only=True)

#     class Meta:
#         model = models.BimGroup
#         fields = ['id', 'name', 'description', 'order', 'bim_categories']

#     def to_representation(self, instance):
#         representation = super().to_representation(instance)
#         if not representation.get('bim_categories'):
#             return None
#         return representation


class BimObjectAttributeSerializer(serializers.ModelSerializer):
    group_name = serializers.ReadOnlyField(source='category.bim_group.name')
    category = serializers.ReadOnlyField(source='category.value')
    value = serializers.ReadOnlyField()

    class Meta:
        model = models.BimObject
        fields = ['group_name', 'category', 'value']


class BimObjectSerializer(serializers.Serializer):
    id = serializers.IntegerField(source='dbid')  # 使用 dbid 作為 id
    dbid = serializers.IntegerField()
    primary_value = serializers.CharField()
    model_name = serializers.CharField(source='category__bim_model__name')
    version = serializers.IntegerField(source='category__bim_model__version')
    urn = serializers.CharField(source='category__bim_model__urn')
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
        return BimCategorySerializer(
            obj.bim_categories.filter(is_active=True),
            many=True,
            context={'fields': ['id']}
        ).data
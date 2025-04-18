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
        fields = ['id', 'value', 'display_name']


class BimConditionSerializer(serializers.ModelSerializer):
    categories = serializers.SerializerMethodField()
    children = serializers.SerializerMethodField()

    class Meta:
        model = models.BimCondition
        fields = ['id', 'name', 'display_name', 'value',  'categories', 'children']

    def get_categories(self, obj):
        categories = obj.bim_categories.filter(is_active=True)
        return BimCategorySerializer(categories, many=True).data

    def get_children(self, obj):
        children = obj.get_children().filter(is_active=True)
        return BimConditionSerializer(children, many=True).data

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if representation.get('categories') == []:
            representation.pop('categories')
        if representation.get('children') == []:
            representation.pop('children')
        return representation


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

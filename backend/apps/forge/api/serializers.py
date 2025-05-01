from rest_framework import serializers

from ..services import get_tender_name
from .. import models


class ModelSerializer(serializers.Serializer):
    bim_model_id = serializers.IntegerField()
    dbid = serializers.IntegerField()


class LevelSerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()
    data = serializers.ListField(child=ModelSerializer())


class BimRegionTreeSerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()
    code = serializers.CharField()
    children = serializers.ListField(child=LevelSerializer())


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
        fields = ['id', 'bim_model', 'value', 'display_name']


class BimConditionSerializer(serializers.ModelSerializer):
    categories = serializers.SerializerMethodField()
    children = serializers.SerializerMethodField()

    class Meta:
        model = models.BimCondition
        fields = ['id', 'name', 'display_name', 'value',  'categories', 'children']

    def get_categories(self, obj):
        categories = obj.bim_categories.filter(is_active=True).order_by('value').distinct('display_name', 'value')
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


class BimObjectSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    dbid = serializers.IntegerField()
    value = serializers.CharField()
    display_name = serializers.CharField()
    name = serializers.CharField(source='bim_model__name')
    version = serializers.IntegerField(source='bim_model__version')
    urn = serializers.CharField(source='bim_model__urn')

    class Meta:
        fields = ['id', 'dbid', 'value', 'display_name', 'name', 'version', 'urn']

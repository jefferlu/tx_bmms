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
    # status = serializers.CharField()

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
    class Meta:
        model = models.BimCategory
        fields = ['id', 'value', 'display_name']


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


class BimObjectSerializer(serializers.ModelSerializer):
    model_name = serializers.ReadOnlyField(source='conversion.bim_model.name')
    version = serializers.ReadOnlyField(source='conversion.version')
    group_name = serializers.ReadOnlyField(source='category.bim_group.name')
    category = serializers.ReadOnlyField(source='category.value')
    urn = serializers.ReadOnlyField(source='conversion.urn')

    class Meta:
        model = models.BimObject
        fields = ['id', 'model_name', 'version', 'group_name', 'category', 'urn', 'dbid', 'value']

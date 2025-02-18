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
                  'original_file', 'svf_file', 'conversion_created_at',]

    def get_tender(self, obj):
        return get_tender_name(obj.name)


class BimCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = models.BimCategory
        fields = ['id', 'name', 'description']


class BimGroupSerializer(serializers.ModelSerializer):
    bim_category = BimCategorySerializer(many=True, read_only=True)  # 嵌套 BimCategory 資料

    class Meta:
        model = models.BimGroup
        fields = ['id', 'name', 'description', 'order', 'bim_category']

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if not representation.get('bim_category'):
            return None
        return representation


class BimPropertySerializer(serializers.ModelSerializer):
    name = serializers.ReadOnlyField(source='conversion.bim_model.name')
    group = serializers.ReadOnlyField(source='category.bim_group.name')
    category = serializers.ReadOnlyField(source='category.name')
    urn = serializers.ReadOnlyField(source='conversion.urn')

    class Meta:
        model = models.BimProperty
        fields = ['id', 'name',  'group', 'category',  'urn', 'key', 'value', 'dbid', ]

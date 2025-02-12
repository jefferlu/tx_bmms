from rest_framework import serializers

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


class BIMConversionSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.BIMConversion
        fields = ['urn', 'version', 'original_file', 'svf_file', 'created_at']


class BIMModelSerializer(serializers.ModelSerializer):
    urn = serializers.CharField(source='latest_urn', allow_null=True)
    version = serializers.IntegerField(source='latest_version', allow_null=True)
    original_file = serializers.CharField(source='latest_original_file', allow_null=True)
    svf_file = serializers.CharField(source='latest_svf_file', allow_null=True)
    conversion_created_at = serializers.DateTimeField(source='latest_conversion_created_at', allow_null=True)

    class Meta:
        model = models.BIMModel
        fields = ['id', 'name', 'created_at', 'urn', 'version',
                  'original_file', 'svf_file', 'conversion_created_at',]

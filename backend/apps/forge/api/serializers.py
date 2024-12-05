from rest_framework import serializers

class ObjectSerializer(serializers.Serializer):
    name = serializers.CharField(source='objectKey')
    size = serializers.IntegerField() 
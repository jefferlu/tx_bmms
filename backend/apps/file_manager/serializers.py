"""
檔案管理系統 Serializers
"""
from rest_framework import serializers


class FileItemSerializer(serializers.Serializer):
    """檔案/資料夾項目序列化器"""
    name = serializers.CharField()
    type = serializers.ChoiceField(choices=['file', 'directory'])
    size = serializers.IntegerField(allow_null=True)
    modified_time = serializers.DateTimeField()
    created_time = serializers.DateTimeField()
    path = serializers.CharField()
    is_writable = serializers.BooleanField()


class FileListResponseSerializer(serializers.Serializer):
    """檔案列表回應序列化器"""
    current_path = serializers.CharField()
    items = FileItemSerializer(many=True)
    permissions = serializers.DictField()


class UploadedFileSerializer(serializers.Serializer):
    """已上傳檔案序列化器"""
    name = serializers.CharField()
    path = serializers.CharField()
    size = serializers.IntegerField()
    message = serializers.CharField()


class FailedFileSerializer(serializers.Serializer):
    """上傳失敗檔案序列化器"""
    name = serializers.CharField()
    message = serializers.CharField()


class UploadResponseSerializer(serializers.Serializer):
    """上傳回應序列化器"""
    success = serializers.BooleanField()
    uploaded_files = UploadedFileSerializer(many=True)
    failed_files = FailedFileSerializer(many=True)


class ActionRequestSerializer(serializers.Serializer):
    """操作請求序列化器"""
    action = serializers.ChoiceField(
        choices=['rename', 'delete', 'move', 'mkdir']
    )
    path = serializers.CharField()
    new_path = serializers.CharField(required=False, allow_blank=True)
    new_name = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        """驗證輸入資料"""
        action = data.get('action')

        if action == 'rename' and not data.get('new_name'):
            raise serializers.ValidationError(
                {'new_name': 'This field is required for rename action'}
            )

        if action == 'move' and not data.get('new_path'):
            raise serializers.ValidationError(
                {'new_path': 'This field is required for move action'}
            )

        if action == 'mkdir' and not data.get('new_name'):
            raise serializers.ValidationError(
                {'new_name': 'This field is required for mkdir action'}
            )

        return data


class ActionResponseSerializer(serializers.Serializer):
    """操作回應序列化器"""
    success = serializers.BooleanField()
    action = serializers.CharField()
    message = serializers.CharField()
    item = FileItemSerializer(required=False)


class PermissionResponseSerializer(serializers.Serializer):
    """權限回應序列化器"""
    can_read = serializers.BooleanField()
    can_write = serializers.BooleanField()

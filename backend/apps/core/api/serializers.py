from django.contrib.auth import get_user_model
from django.contrib.auth.models import update_last_login
from django.contrib.auth.models import Permission, Group

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer

import jwt
from .. import models

User = get_user_model()


class TokenObtainSerializer(TokenObtainPairSerializer):

    @classmethod
    def get_token(self, user):

        token = super().get_token(user)

        # Add custom claims
        # token['name'] = user.username
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        update_last_login(None, self.user)

        data['user'] = UserSerializer(self.user).data
        return data


class RefreshObtainSerializer(TokenRefreshSerializer):

    def validate(self, attrs):
        data = super(RefreshObtainSerializer, self).validate(attrs)
        decoded_data = jwt.decode(attrs['refresh'], options={"verify_signature": False})
        user = User.objects.get(id=decoded_data['user_id'])

        data['user'] = UserSerializer(user).data

        return data


class PasswordResetSerializer(serializers.Serializer):
    password = serializers.CharField(required=True, write_only=True)

    def validate_password(self, value):
        return value


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ['id', 'name', 'codename',]


class GroupSerializer(serializers.ModelSerializer):
    permissions = PermissionSerializer(many=True, read_only=True)

    class Meta:
        fields = ['id', 'name', 'permissions',]
        model = Group


class UserSerializer(serializers.ModelSerializer):
    groups_obj = serializers.SerializerMethodField()
    bim_criteria = serializers.SerializerMethodField()

    class Meta:
        model = User
        # fields = '__all__'
        exclude = ['first_name', 'last_name', 'is_staff',]
        extra_kwargs = {
            'password': {'write_only': True, 'required': False},
            'email': {'required': False},
            'date_joined': {'read_only': True},
            'last_login': {'read_only': True}
        }

    def get_groups_obj(self, obj):
        return GroupSerializer(obj.groups, many=True).data

    def get_bim_criteria(self, obj):
        # 透過 user_profile 關聯獲取 bim_criteria
        try:
            return obj.user_profile.bim_criteria
        except models.UserProfile.DoesNotExist:
            return {}

    def create(self, validated_data):
        user = User(
            username=validated_data['username'],
            email=validated_data['email'],
            is_superuser=validated_data['is_superuser']
        )
        user.set_password(validated_data['password'])
        user.save()

        # 新增group權限
        user.groups.set(validated_data.get('groups', []))
        return user

    def update(self, instance, validated_data):
        instance.username = validated_data.get('username', instance.username)
        instance.email = validated_data.get('email', instance.email)
        instance.is_superuser = validated_data.get('is_superuser', instance.is_superuser)
        instance.groups.set(validated_data.get('groups', instance.groups))

        # 檢查是否提供了新密碼，如果是，則更新密碼
        password = validated_data.get('password')
        if password:
            instance.set_password(password)

        instance.save()
        return instance

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.UserProfile
        fields = ['bim_criteria',]  


class NavigationSerializer(serializers.ModelSerializer):

    children = serializers.SerializerMethodField()

    class Meta:
        fields = '__all__'
        model = models.Navigation

    def get_children(self, obj) -> list:
        children = obj.get_children()
        return NavigationSerializer(children, many=True).data if children.exists() else []

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        # 如果 'children' 欄位的值是空字串，則移除該欄位
        if representation.get('children') == []:
            representation.pop('children')
        return representation


class LocaleSerializer(serializers.ModelSerializer):
    id = serializers.ReadOnlyField(source='lang')
    label = serializers.ReadOnlyField(source='name')

    class Meta:
        model = models.Locale
        fields = ['id', 'label',]


class TranslationSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Translation
        fields = ['key', 'value']


class ApsCredentialsSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.ApsCredentials
        fields = "__all__"


class LogUserActivitySerializer(serializers.ModelSerializer):
    username = serializers.ReadOnlyField(source='user.username')
    email = serializers.ReadOnlyField(source='user.email')

    class Meta:
        model = models.LogUserActivity
        fields = "__all__"

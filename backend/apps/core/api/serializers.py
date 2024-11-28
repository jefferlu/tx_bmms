from django.contrib.auth import get_user_model
from django.contrib.auth.models import update_last_login

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


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'
        extra_kwargs = {
            'password': {'write_only': True, 'required': False},
            'email': {'required': False},
            'date_joined': {'read_only': True},
            'last_login': {'read_only': True}
        }

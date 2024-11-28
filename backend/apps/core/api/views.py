from rest_framework import viewsets, mixins, status, exceptions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from drf_spectacular.utils import extend_schema, extend_schema_view

from . import serializers


@extend_schema(
    summary="Login",
    description="Endpoint to obtain JWT token pair",
    tags=['Authentication']
)
class TokenObtainView(TokenObtainPairView):
    serializer_class = serializers.TokenObtainSerializer


class RefreshObtainView(TokenRefreshView):
    serializer_class = serializers.RefreshObtainSerializer


@extend_schema(
    summary="Reset Password",
    description="Chane login user password",
    tags=['Authentication']
)
class PasswordResetView(APIView):
    serializer_class = serializers.PasswordResetSerializer

    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        user = request.user

        if not user.is_authenticated:
            return Response({'detail': 'User not authenticated.'}, status=status.HTTP_401_UNAUTHORIZED)

        if serializer.is_valid():
            password = serializer.validated_data.get('password')
            if user and password:
                user.set_password(password)
                user.save()

                # 創建新的JWT刷新令牌
                refresh = RefreshToken.for_user(user)
                access_token = str(refresh.access_token)

                return Response({'access_token': access_token}, status=status.HTTP_200_OK)
            else:
                return Response({'detail': 'User not authenticated.'}, status=status.HTTP_401_UNAUTHORIZED)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

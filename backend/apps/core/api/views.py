from django.contrib.auth import get_user_model

from rest_framework import viewsets, mixins, status, exceptions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser, IsAuthenticated, AllowAny

from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken

from django_auto_prefetching import AutoPrefetchViewSetMixin
from drf_spectacular.utils import extend_schema, extend_schema_view

from . import serializers

User = get_user_model()


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


@extend_schema_view(
    list=extend_schema(operation_id="list_users", summary="List users",
                       description="Retrieve a list of all users", tags=["Users"]),
    create=extend_schema(operation_id="create_user", summary="Create user",
                         description="Create a new user", tags=["Users"]),
    update=extend_schema(operation_id="update_user", summary="Update user",
                         description="Update an existing user", tags=["Users"]),
    partial_update=extend_schema(operation_id="partial_update_user", summary="Partial update user",
                                 description="Partially update an existing user", tags=["Users"]),
    retrieve=extend_schema(operation_id="retrieve_user", summary="Retrieve user",
                           description="Retrieve details of a user", tags=["Users"]),
    destroy=extend_schema(operation_id="delete_user", summary="Delete user",
                          description="Delete an existing user", tags=["Users"])
)
class UserViewSet(AutoPrefetchViewSetMixin, viewsets.ModelViewSet):
    # if (not settings.DEBUG):
    permission_classes = (IsAdminUser, )
    serializer_class = serializers.UserSerializer
    queryset = User.objects.all().order_by('id')


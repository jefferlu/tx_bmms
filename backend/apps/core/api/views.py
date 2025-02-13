from django.contrib.auth import get_user_model
from django.core.cache import cache

from rest_framework import viewsets, mixins, status, exceptions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser, IsAuthenticated, AllowAny

from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken

from django_auto_prefetching import AutoPrefetchViewSetMixin
from drf_spectacular.utils import extend_schema, extend_schema_view

from .. import models
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


class NavigationViewSet(AutoPrefetchViewSetMixin, viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, )
    serializer_class = serializers.NavigationSerializer
    queryset = models.Navigation.objects.all().order_by('id')

    def get_queryset(self):
        user = self.request.user
        return models.Navigation.objects.filter(
            parent__isnull=True,
        ).order_by('id')

    def list(self, request, *args, **kwargs):
        # qs = self.get_queryset()
        # seriailzer = self.get_serializer(qs, many=True)

        navigations = self.get_user_navigations(request.user)

        if navigations is None:
            return Response(
                {
                    "code": "no-navigation-permission",
                    "detail": "您沒有任何可操作之功能權限"
                },
                status=status.HTTP_403_FORBIDDEN
            )

        # 包裝前端 Navigation 元件需要的格式
        return Response({'compact': navigations})

    def get_user_navigations(self, user):

        def filter_navigation(navigation):
            """
            遞歸過濾導航結構，對type為collapsable的節點不檢查權限，僅需顯示其有權限的子節點。
            """
            if navigation.type in ['collapsable', 'group']:
                # 遞歸過濾子節點，保留有權限的子節點
                children_with_permissions = [
                    filter_navigation(child) for child in navigation.get_children()
                    if child in (allowed_navigations or child.type in ['collapsable', 'group'])
                ]
                children_with_permissions = [child for child in children_with_permissions if child is not None]

                # 僅當存在有權限的子節點時顯示此collapsable節點
                if children_with_permissions:
                    navigation_data = serializers.NavigationSerializer(navigation).data
                    navigation_data['children'] = children_with_permissions
                    return navigation_data
            elif navigation.type == 'basic' and navigation in allowed_navigations:
                # 返回type為basic且用戶有權限的導航
                return serializers.NavigationSerializer(navigation).data
            return None

        # 獲取用戶的權限
        allowed_navigations = models.Navigation.objects.filter(
            is_active=True).distinct()

        # 如果是超級用戶，直接返回所有活躍導航項目
        if not user.is_superuser:
            # 篩選出用戶有權限的導航項目
            allowed_navigations = [
                navigation for navigation in allowed_navigations
                if any(user.has_perm(f"{perm.content_type.app_label}.{perm.codename}") for perm in navigation.permissions.all())
            ]

        # 如果沒有可訪問的導航
        if not allowed_navigations:
            return None

        # 處理所有根節點
        root_navigations = models.Navigation.objects.filter(
            parent__isnull=True, is_active=True).order_by('order')
        filtered_navigations = [filter_navigation(nav) for nav in root_navigations]

        # 移除None值，僅保留有權限的導航項目
        return [nav for nav in filtered_navigations if nav is not None]


class LocaleViewSet(viewsets.ModelViewSet):
    permission_classes = ()
    queryset = models.Locale.objects.filter(is_active=True,).order_by('id')
    serializer_class = serializers.LocaleSerializer


class TranslationViewSet(AutoPrefetchViewSetMixin, viewsets.ModelViewSet):
    serializer_class = serializers.TranslationSerializer
    queryset = models.Translation.objects.all().order_by('id')

    def list(self, request):
        lang = request.GET.get('lang', 'en').lower()  # 預設語言為 'en'

        qs = models.Translation.objects.filter(locale__lang=lang)
        translations = {t.key: t.value for t in qs}

        return Response(translations)


class ApsCredentialsViewSet(viewsets.ModelViewSet):
    permission_classes = ()
    queryset = models.ApsCredentials.objects.all()
    serializer_class = serializers.ApsCredentialsSerializer

    def get_queryset(self):
        print(self.request.user.user_profile.company)
        return models.ApsCredentials.objects.filter(company=self.request.user.user_profile.company)

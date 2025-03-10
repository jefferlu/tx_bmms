from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.contrib.auth.models import Group, Permission
from django.db.models import Q
from django.shortcuts import get_object_or_404

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
from ..services import log_user_activity

User = get_user_model()


@extend_schema(
    summary="Login",
    description="Endpoint to obtain JWT token pair",
    tags=['Authentication']
)
class TokenObtainView(TokenObtainPairView):
    serializer_class = serializers.TokenObtainSerializer

    def post(self, request, *args, **kwargs):
        # 獲取登入請求中的使用者名稱和 IP 位址
        email = request.data.get('email')
        ip_address = request.META.get('REMOTE_ADDR')

        # 呼叫父類的 post 方法，這將處理令牌生成邏輯
        response = super().post(request, *args, **kwargs)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            user = None

        # 記錄操作
        log_user_activity(user, '使用者登入', '登入系統', 'SUCCESS', ip_address)

        return response


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

    # def list(self, request, *args, **kwargs):
    #     response = super().list(request, *args, **kwargs)
    #     # 記錄操作
    #     ip_address = request.META.get('REMOTE_ADDR')
    #     log_user_activity(self.request.user, '帳戶管理', f'查詢', 'SUCCESS', ip_address)
    #     return response

    def create(self, request, *args, **kwargs):
        email = request.data.get('email')
        ip_address = request.META.get('REMOTE_ADDR')
        try:
            response = super().create(request, *args, **kwargs)
            # 記錄成功的操作
            log_user_activity(self.request.user, '帳戶管理', f'新增 {email} 成功', 'SUCCESS', ip_address)
            return response
        except Exception as e:
            # 記錄失敗的操作
            log_user_activity(request.user, '帳戶管理', f'新增 {email} 失敗 ({str(e)})', 'FAILURE', ip_address)
            raise  # 重新拋出錯誤，讓 DRF 處理返回

    def update(self, request, *args, **kwargs):
        email = request.data.get('email')
        ip_address = request.META.get('REMOTE_ADDR')
        try:
            response = super().update(request, *args, **kwargs)
            log_user_activity(self.request.user, '帳戶管理', f'修改 {email} 成功', 'SUCCESS', ip_address)
            return response
        except Exception as e:
            log_user_activity(request.user, '帳戶管理', f'修改 {email} 失敗 ({str(e)})', 'FAILURE', ip_address)
            raise

    def destroy(self, request, *args, **kwargs):
        user_id = kwargs.get('pk')  # 取得 URL 參數中的 id
        ip_address = request.META.get('REMOTE_ADDR')

        try:
            user_instance = User.objects.get(id=user_id)  # 查詢 User 物件
            email = user_instance.email  # 取得 email

            response = super().destroy(request, *args, **kwargs)
            log_user_activity(request.user, '帳戶管理', f'刪除 {email} 成功', 'SUCCESS', ip_address)
            return response
        except Exception as e:
            log_user_activity(request.user, '帳戶管理', f'刪除 {user_id} 失敗 ({str(e)})', 'FAILURE', ip_address)
            raise


@extend_schema_view(
    list=extend_schema(operation_id="list_groups", summary="List groups",
                       description="Retrieve a list of all groups", tags=["Groups"]),
    create=extend_schema(operation_id="create_groups", summary="Create groups",
                         description="Create a new groups", tags=["Groups"]),
    update=extend_schema(operation_id="update_groups", summary="Update groups",
                         description="Update an existing groups", tags=["Groups"]),
    partial_update=extend_schema(operation_id="partial_update_groups", summary="Partial update groups",
                                 description="Partially update an existing groups", tags=["Groups"]),
    retrieve=extend_schema(operation_id="retrieve_groups", summary="Retrieve groups",
                           description="Retrieve details of a groups", tags=["Groups"]),
    destroy=extend_schema(operation_id="delete_groups", summary="Delete groups",
                          description="Delete an existing groups", tags=["Groups"])
)
class GroupViewSet(AutoPrefetchViewSetMixin, viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated,)
    serializer_class = serializers.GroupSerializer
    queryset = Group.objects.all().order_by('id')

    def get_permissions(self):
        return super().get_permissions()

    def get_queryset(self):
        return Group.objects.prefetch_related('permissions').order_by('id')

    def create(self, request, *args, **kwargs):
        ip_address = request.META.get('REMOTE_ADDR')

        # 解析請求中的權限資料
        permissions_data = request.data.get('permissions', [])
        permission_ids = [permission["id"] for permission in permissions_data]

        # 創建 Group 實例（先不包含 permissions）
        group_serializer = self.get_serializer(data={"name": request.data.get("name")})

        if group_serializer.is_valid():
            group = group_serializer.save()  # 先儲存 Group
            # 設定權限關聯
            group.permissions.set(permission_ids)  # 使用 ID 設定 ManyToMany 關聯
            group.save()  # 確保變更存入資料庫

            try:
                # 記錄成功的操作
                log_user_activity(self.request.user, '權限設定', f'新增 {group.name} 成功', 'SUCCESS', ip_address)
                return Response(serializers.GroupSerializer(group).data, status=201)
            except Exception as e:
                # 記錄失敗的操作
                log_user_activity(request.user, '帳戶管理', f'新增 {group.name} 失敗 ({str(e)})', 'FAILURE', ip_address)
                raise  # 重新拋出錯誤，讓 DRF 處理返回

        return Response(group_serializer.errors, status=400)

    def update(self, request, *args, **kwargs):
        ip_address = request.META.get('REMOTE_ADDR')

        # 解析請求中的權限資料
        permissions_data = request.data.get('permissions', [])
        permission_ids = []

        # 根據傳入的權限資料，從資料庫查找對應的 Permission 實例
        for permission in permissions_data:
            permission_instance = get_object_or_404(Permission, id=permission['id'])
            permission_ids.append(permission_instance)

        # 更新 Group 實例
        group = self.get_object()  # 獲取要更新的 Group 實例
        group.name = request.data.get('name', group.name)
        group.permissions.set(permission_ids)  # 更新權限關聯
        group.save()

        try:
            # 記錄成功的操作
            log_user_activity(self.request.user, '權限設定', f'修改 {group.name} 成功', 'SUCCESS', ip_address)
            
            # 返回更新後的 Group 資料
            group_serializer = self.get_serializer(group)
            return Response(group_serializer.data)
        except Exception as e:
            # 記錄失敗的操作
            log_user_activity(request.user, '帳戶管理', f'修改 {group.name} 失敗 ({str(e)})', 'FAILURE', ip_address)
            raise  # 重新拋出錯誤，讓 DRF 處理返回

    def destroy(self, request, *args, **kwargs):
        id = kwargs.get('pk')  # 取得 URL 參數中的 id
        ip_address = request.META.get('REMOTE_ADDR')

        try:
            group = Group.objects.get(id=id)  # 查詢 User 物件            

            response = super().destroy(request, *args, **kwargs)
            log_user_activity(request.user, '帳戶管理', f'刪除 {group.name} 成功', 'SUCCESS', ip_address)
            return response
        except Exception as e:
            log_user_activity(request.user, '帳戶管理', f'刪除 {group.name} 失敗 ({str(e)})', 'FAILURE', ip_address)
            raise
        
class PermissionViewSet(AutoPrefetchViewSetMixin, viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated,)
    serializer_class = serializers.PermissionSerializer
    queryset = Permission.objects.all().order_by('id')

    def get_permissions(self):
        return super().get_permissions()

    def get_queryset(self):
        return Permission.objects.filter(Q(content_type__app_label='core') & Q(content_type__model='navigation'))


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
            if navigation.type in ['collapsable', 'group', 'aside']:
                # 遞歸過濾子節點，保留有權限的子節點
                children_with_permissions = [
                    filter_navigation(child) for child in navigation.get_children()
                    if child in (allowed_navigations or child.type in ['collapsable', 'group', 'aside'])
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


class LocaleViewSet(AutoPrefetchViewSetMixin, viewsets.ModelViewSet):
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


class ApsCredentialsViewSet(AutoPrefetchViewSetMixin, viewsets.ModelViewSet):
    permission_classes = ()
    queryset = models.ApsCredentials.objects.all()
    serializer_class = serializers.ApsCredentialsSerializer

    def get_queryset(self):
        return models.ApsCredentials.objects.filter(company=self.request.user.user_profile.company)

    def update(self, request, *args, **kwargs):       
        ip_address = request.META.get('REMOTE_ADDR')
        try:
            response = super().update(request, *args, **kwargs)
            log_user_activity(self.request.user, '帳戶管理', f'修改憑證成功', 'SUCCESS', ip_address)
            return response
        except Exception as e:
            log_user_activity(request.user, '帳戶管理', f'修改憑證失敗 ({str(e)})', 'FAILURE', ip_address)
            raise

class LogUserActivityViewSet(AutoPrefetchViewSetMixin, viewsets.ReadOnlyModelViewSet):
    permission_classes = ()
    queryset = models.LogUserActivity.objects.all()
    serializer_class = serializers.LogUserActivitySerializer

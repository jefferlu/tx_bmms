import os
import csv
import docker
import pandas as pd
import logging

from io import BytesIO, StringIO
from datetime import datetime

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.contrib.auth.models import Group, Permission
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.conf import settings
from django.http import FileResponse, StreamingHttpResponse
from django.core.files.uploadedfile import UploadedFile

from rest_framework import viewsets, generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser, IsAuthenticated, AllowAny
from rest_framework.exceptions import NotFound
from rest_framework.pagination import PageNumberPagination
from rest_framework.decorators import action

from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken

from django_auto_prefetching import AutoPrefetchViewSetMixin
from drf_spectacular.utils import extend_schema, extend_schema_view

from .. import models
from . import serializers
from ..services import log_user_activity
from .tasks import backup_database, restore_database

# 設定日誌記錄器
logger = logging.getLogger(__name__)

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


class UserCriteriaView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = serializers.UserProfileSerializer

    def get_object(self):
        try:
            return models.UserProfile.objects.select_related('user', 'company').get(user=self.request.user)
        except models.UserProfile.DoesNotExist:
            self.fail("UserProfile does not exist")

    def perform_update(self, serializer):
        serializer.save(bim_criteria=self.request.data)


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
    queryset = models.Locale.objects.filter(is_active=True,).order_by('id')
    serializer_class = serializers.LocaleSerializer

    def get_permissions(self):
        """
        允許未認證用戶讀取語言列表，但只有管理員可以修改
        """
        if self.action in ['list', 'retrieve']:
            permission_classes = [AllowAny]
        else:
            permission_classes = [IsAdminUser]
        return [permission() for permission in permission_classes]


class TranslationViewSet(AutoPrefetchViewSetMixin, viewsets.ModelViewSet):
    serializer_class = serializers.TranslationSerializer
    queryset = models.Translation.objects.all().order_by('id')

    def get_permissions(self):
        """
        允許未認證用戶讀取翻譯資料（網頁初始化需要），但只有管理員可以修改
        """
        if self.action in ['list', 'retrieve']:
            permission_classes = [AllowAny]
        else:
            permission_classes = [IsAdminUser]
        return [permission() for permission in permission_classes]

    def list(self, request):
        try:
            lang = request.GET.get('lang', 'en').lower()
            qs = models.Translation.objects.filter(locale__lang=lang, locale__is_active=True)
            if not qs.exists():
                return Response(
                    {"message": f"沒有找到語言 {lang} 的翻譯資料"},
                    status=status.HTTP_404_NOT_FOUND
                )
            translations = {t.key: t.value for t in qs}
            return Response(translations)
        except Exception as e:
            logger.error(f"Error retrieving translations for lang {lang}: {str(e)}", exc_info=True)
            return Response(
                {"error": "伺服器內部錯誤，請聯繫管理員"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def download_excel(self, request):
        try:
            locales = models.Locale.objects.filter(is_active=True).values_list('lang', flat=True)
            if not locales:
                return Response(
                    {"message": "沒有找到任何活躍的語系"},
                    status=status.HTTP_404_NOT_FOUND
                )

            translations = models.Translation.objects.filter(locale__is_active=True).select_related('locale').order_by('key')
            if not translations.exists():
                buffer = BytesIO()
                df = pd.DataFrame(columns=['no', 'key'] + list(locales))
                with pd.ExcelWriter(buffer, engine='xlsxwriter') as writer:
                    df.to_excel(writer, index=False, sheet_name='Translations')
                buffer.seek(0)
                return FileResponse(
                    buffer,
                    as_attachment=True,
                    filename='translations.xlsx',
                    content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                )

            data = {}
            keys = set()
            for t in translations:
                key = t.key
                lang = t.locale.lang
                if key not in data:
                    data[key] = {}
                data[key][lang] = t.value
                keys.add(key)

            rows = []
            for idx, key in enumerate(sorted(keys), start=1):
                row = {'no': idx, 'key': key}
                for lang in locales:
                    row[lang] = data[key].get(lang, '')
                rows.append(row)

            df = pd.DataFrame(rows, columns=['no', 'key'] + list(locales))
            buffer = BytesIO()
            with pd.ExcelWriter(buffer, engine='xlsxwriter') as writer:
                df.to_excel(writer, index=False, sheet_name='Translations')
                worksheet = writer.sheets['Translations']
                for idx, col in enumerate(df.columns):
                    max_len = max(df[col].astype(str).map(len).max(), len(col)) + 2
                    worksheet.set_column(idx, idx, max_len)

            buffer.seek(0)
            return FileResponse(
                buffer,
                as_attachment=True,
                filename='translations.xlsx',
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
        except ImportError as e:
            logger.error(f"Missing required module: {str(e)}", exc_info=True)
            return Response(
                {"error": "伺服器缺少必要模組，請聯繫管理員"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            logger.error(f"Error generating Excel: {str(e)}", exc_info=True)
            return Response(
                {"error": "伺服器內部錯誤，請聯繫管理員"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'], url_path='upload_excel')
    def upload_excel(self, request):
        try:
            if 'file' not in request.FILES:
                return Response(
                    {"error": "請提供 Excel 檔案"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            file: UploadedFile = request.FILES['file']
            if not file.name.lower().endswith('.xlsx'):
                return Response(
                    {"error": "請上傳有效的 Excel 檔案（.xlsx）"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            locales = models.Locale.objects.filter(is_active=True)
            if not locales.exists():
                return Response(
                    {"message": "沒有找到任何活躍的語系"},
                    status=status.HTTP_404_NOT_FOUND
                )

            locale_map = {locale.lang: locale for locale in locales}
            expected_columns = {'no', 'key'} | set(locale_map.keys())
            df = pd.read_excel(file, engine='openpyxl')
            if not set(df.columns).issuperset(expected_columns):
                return Response(
                    {"error": f"Excel 檔案格式錯誤，預期欄位：{', '.join(expected_columns)}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 驗證 key 非空且唯一
            df['key'] = df['key'].astype(str).str.strip()
            if df['key'].isnull().any() or df['key'].duplicated().any():
                return Response(
                    {"error": "Excel 檔案包含空鍵或重複鍵"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 轉換為長格式（melt）以處理語系
            id_vars = ['key']
            value_vars = [col for col in df.columns if col in locale_map]
            melted = pd.melt(
                df,
                id_vars=id_vars,
                value_vars=value_vars,
                var_name='lang',
                value_name='value'
            ).dropna(subset=['value'])

            # 準備新記錄
            new_translations = []
            errors = []
            melted['value'] = melted['value'].astype(str).str.strip()
            for _, row in melted.iterrows():
                key = row['key']
                lang = row['lang']
                value = row['value']
                if lang not in locale_map:
                    errors.append(f"無效語系 {lang} 在鍵 {key}")
                    continue
                new_translations.append(
                    models.Translation(
                        locale=locale_map[lang],
                        key=key,
                        value=value
                    )
                )

            if errors:
                return Response(
                    {"error": "Excel 檔案包含無效資料", "details": errors},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 刪除並創建
            with transaction.atomic():
                models.Translation.objects.filter(locale__is_active=True).delete()
                models.Translation.objects.bulk_create(new_translations, batch_size=1000)

            return Response(
                {"message": f"成功同步 {len(new_translations)} 筆翻譯資料", "count": len(new_translations)},
                status=status.HTTP_200_OK
            )

        except pd.errors.EmptyDataError:
            return Response(
                {"error": "上傳的 Excel 檔案為空"},
                status=status.HTTP_400_BAD_REQUEST
            )
        except ImportError as e:
            logger.error(f"Missing required module: {str(e)}", exc_info=True)
            return Response(
                {"error": "伺服器缺少必要模組，請聯繫管理員"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            logger.error(f"Error processing Excel upload: {str(e)}", exc_info=True)
            return Response(
                {"error": "伺服器內部錯誤，請聯繫管理員"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ApsCredentialsViewSet(AutoPrefetchViewSetMixin, viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated,)
    queryset = models.ApsCredentials.objects.all()
    serializer_class = serializers.ApsCredentialsSerializer

    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return models.ApsCredentials.objects.none()
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


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 100
    page_size_query_param = 'size'
    max_page_size = 100


class LogUserActivityViewSet(AutoPrefetchViewSetMixin, viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAdminUser]  # 只有管理員可以查看審計日誌
    queryset = models.LogUserActivity.objects.all().order_by('-timestamp')  # 按 timestamp 降序
    serializer_class = serializers.LogUserActivitySerializer
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get('search', None)

        if search:
            # 模糊查詢所有欄位
            queryset = queryset.filter(
                Q(user__username__icontains=search) |
                Q(user__email__icontains=search) |
                Q(function__icontains=search) |
                Q(action__icontains=search) |
                Q(status__icontains=search) |
                Q(ip_address__icontains=search)
            )

        return queryset

    def _generate_csv_rows(self, queryset, headers):
        """生成 CSV 行的生成器"""
        # CSV 標題
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        yield '\ufeff' + output.getvalue()  # BOM + 標題
        output.truncate(0)
        output.seek(0)

        # 數據行
        for log in queryset.iterator(chunk_size=100):
            writer = csv.writer(output)
            writer.writerow([
                log.user.email if log.user else '',
                log.user.username if log.user else '',
                log.function,
                log.action,
                log.status,
                log.timestamp.strftime('%Y/%m/%d %H:%M:%S'),
                log.ip_address or ''
            ])
            yield output.getvalue()
            output.truncate(0)
            output.seek(0)

    def _generate_txt_rows(self, queryset, headers):
        """生成 TXT 行的生成器（Tab 分隔）"""
        # TXT 標題
        yield '\t'.join(headers) + '\n'

        # 數據行
        for log in queryset.iterator(chunk_size=100):
            yield f"{log.user.email if log.user else ''}\t" \
                  f"{log.user.username if log.user else ''}\t" \
                  f"{log.function}\t" \
                  f"{log.action}\t" \
                  f"{log.status}\t" \
                  f"{log.timestamp.strftime('%Y/%m/%d %H:%M:%S')}\t" \
                  f"{log.ip_address or ''}\n"

    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        """導出 CSV 格式（流式響應）"""
        # 從查詢參數獲取標題（前端提供，逗號分隔）
        headers_str = request.query_params.get('headers', '')
        if headers_str:
            headers = headers_str.split(',')
        else:
            headers = ['Account', 'Name', 'Function', 'Action', 'Status', 'Timestamp', 'IP Address']

        queryset = self.get_queryset()
        response = StreamingHttpResponse(
            self._generate_csv_rows(queryset, headers),
            content_type='text/csv; charset=utf-8'
        )
        filename = f"user_activity_log_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.csv"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    @action(detail=False, methods=['get'])
    def export_txt(self, request):
        """導出 TXT 格式（Tab 分隔，流式響應）"""
        # 從查詢參數獲取標題（前端提供，逗號分隔）
        headers_str = request.query_params.get('headers', '')
        if headers_str:
            headers = headers_str.split(',')
        else:
            headers = ['Account', 'Name', 'Function', 'Action', 'Status', 'Timestamp', 'IP Address']

        queryset = self.get_queryset()
        response = StreamingHttpResponse(
            self._generate_txt_rows(queryset, headers),
            content_type='text/plain; charset=utf-8'
        )
        filename = f"user_activity_log_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.txt"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class DockerLogsView(APIView):
    def get(self, request, container_name):
        lines = request.query_params.get("lines", None)
        client = docker.from_env()

        try:
            container = client.containers.get(container_name)
            logs = container.logs(tail=int(lines)).decode("utf-8") if lines else container.logs().decode("utf-8")
            return Response({"container": container_name, "logs": logs})
        except docker.errors.NotFound:
            raise NotFound(f"容器 '{container_name}' 不存在")
        except Exception as e:
            return Response({"error": f"無法讀取日誌: {str(e)}"}, status=500)


class DbBackupView(APIView):
    permission_classes = (IsAdminUser, )

    def get(self, request):

        ip_address = request.META.get('REMOTE_ADDR')
        log_user_activity(self.request.user, '備份還原', f'備份資料庫', 'SUCCESS', ip_address)

        # 呼叫 Celery 任務來進行資料庫備份
        task = backup_database.delay()
        return Response({"task_id": task.id}, status=202)


class DbRestoreView(APIView):
    permission_classes = (IsAdminUser, )

    def get(self, request):

        ip_address = request.META.get('REMOTE_ADDR')
        log_user_activity(self.request.user, '備份還原', f'還原資料庫', 'SUCCESS', ip_address)

        # 呼叫 Celery 任務來執行資料庫還原
        task = restore_database.delay()

        # 返回 task_id 以便追蹤進度
        return Response({"task_id": task.id})


class LatestBackupView(APIView):
    permission_classes = (IsAdminUser, )

    def get(self, request):
        # 使用 volume 映射的宿主機備份目錄
        backup_dir = os.path.join(settings.MEDIA_ROOT, "backups")

        # 確保備份目錄存在
        if not os.path.exists(backup_dir):
            return Response({"latest_backup": f"找不到備份目錄"})

        # 取得目錄中的所有檔案
        try:
            backups = [f for f in os.listdir(backup_dir) if os.path.isfile(os.path.join(backup_dir, f))]
            if not backups:
                return Response({"latest_backup": "備份目錄沒有任何檔案"})

            # 根據檔案名稱排序，取出最新的備份檔案
            backups.sort(reverse=True)  # 降序排列，最新的檔案排在最前面
            latest_backup = backups[0]

            return Response({"latest_backup": latest_backup})

        except Exception as e:
            return Response({"error": f"無法獲取備份檔案: {str(e)}"}, status=500)

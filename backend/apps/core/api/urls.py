from django.urls import path, include,re_path

from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt import views as jwt_views
from rest_framework_simplejwt.views import TokenRefreshView

from . import views


class OptionalSlashRouter(DefaultRouter):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.trailing_slash = '/?'


router = OptionalSlashRouter()
router.register(r'users', views.UserViewSet)
router.register(r'groups', views.GroupViewSet)
router.register(r'permissions', views.PermissionViewSet)
router.register(r'navigations', views.NavigationViewSet)
router.register(r'translations', views.TranslationViewSet)
router.register(r'locales', views.LocaleViewSet)
router.register(r"aps-credentials", views.ApsCredentialsViewSet)
router.register(r"log-user-activity", views.LogUserActivityViewSet)

urlpatterns = [
    path('login', views.TokenObtainView.as_view(), name='token_obtain_pair'),
    path('refresh-token', views.RefreshObtainView.as_view(), name='token_refresh'),
    path('reset-password', views.PasswordResetView.as_view(), name='reset_password'),
    re_path(r"^docker-logs/(?P<container_name>\w+)/?$", views.DockerLogsView.as_view(), name="docker-logs"),
    re_path(r"^db-backup/?$", views.DbBackupView.as_view(), name="db-backup"),
    re_path(r"^db-restore/?$", views.DbRestoreView.as_view(), name="db-restore"),
    re_path(r"^latest-backup/?$", views.LatestBackupView.as_view(), name="latest-backup"),
    path('', include(router.urls)),
]

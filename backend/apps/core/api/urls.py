from django.urls import path, include

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
router.register(r'navigations', views.NavigationViewSet)
router.register(r'translations', views.TranslationViewSet)
router.register(r'locales', views.LocaleViewSet)
router.register(r"autodesk-credentials", views.ApsCredentialsViewSet)

urlpatterns = [
    path('login', views.TokenObtainView.as_view(), name='token_obtain_pair'),
    path('refresh-token', views.RefreshObtainView.as_view(), name='token_refresh'),
    path('reset-password', views.PasswordResetView.as_view(), name='reset_password'),
    
    path('', include(router.urls)),
]

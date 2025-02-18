from django.urls import path, include, re_path
from django.views.decorators.csrf import csrf_exempt

from rest_framework.routers import DefaultRouter

from . import views


class OptionalSlashRouter(DefaultRouter):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.trailing_slash = '/?'


router = OptionalSlashRouter()
router.register(r'bim-group', views.BimGroupViewSet)
router.register(r'bim-model', views.BimModelViewSet)
router.register(r'bim-property', views.BimPropertyViewSet, basename='bim_property')

urlpatterns = [
    re_path(r'^auth/?$', views.AuthView.as_view(), name='auth'),
    re_path(r'^buckets/?$', views.BucketView.as_view(), name='buckets'),
    re_path(r'^objects/?$', views.ObjectView.as_view(), name='objects'),
    re_path(r'^objects/(?P<name>[\w\-.()%\s]+)$', views.ObjectView.as_view(), name='objects_delete'),
    re_path(r'^compare-sqlite/?$', views.CompareSqliteView.as_view(), name='compare_selite'),
    re_path(r'^bim-data-import/?$', views.BimDataImportView.as_view(), name='bim_data_import'),
    re_path(r'^bim-data-reload/?$', views.BimDataReloadView.as_view(), name='bim_data_reload'),

    path('', include(router.urls)),
]

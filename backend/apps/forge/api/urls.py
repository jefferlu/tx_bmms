from django.urls import path, include, re_path
from django.views.decorators.csrf import csrf_exempt

from rest_framework.routers import DefaultRouter

from . import views
from apps.core.api import views as core_views


class OptionalSlashRouter(DefaultRouter):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.trailing_slash = '/?'


router = OptionalSlashRouter()
router.register(r'bim-conditions', views.BimConditionViewSet)
router.register(r'bim-regions', views.BimRegionViewSet)
router.register(r'bim-model', views.BimModelViewSet)
router.register(r'bim-object', views.BimObjectViewSet, basename='bim-object')
router.register(r'bim-cobie-objects', views.BimCobieObjectViewSet)
router.register(r'bim-cobie', views.BimCobieViewSet)

urlpatterns = [
    re_path(r'^auth/?$', views.AuthView.as_view(), name='auth'),
    re_path(r'^buckets/?$', views.BucketView.as_view(), name='buckets'),
    re_path(r'^objects/?$', views.ObjectView.as_view(), name='objects'),    
    re_path(r'^objects/(?P<name>.+)$', views.ObjectView.as_view(), name='objects-delete'),
    re_path(r'^compare-sqlite/?$', views.CompareSqliteView.as_view(), name='compare-sqlite'),
    re_path(r'^bim-data-import/?$', views.BimDataImportView.as_view(), name='bim-data-import'),
    re_path(r'^bim-data-revert/?$', views.BimDataRevertView.as_view(), name='bim-data-reload'),
    re_path(r'^bim-update-categories/?$', views.BimUpdateCategoriesView.as_view(), name='bim-update-categories'),
    re_path(r"^user-criteria/?$", core_views.UserCriteriaView.as_view(), name="update-user-criteria"),
    re_path(r"^bim-original-file-download/?$", views.BimOriginalFileDownloadView.as_view(), name='bim-original-file-download'),
    re_path(r"^bim-sqlite-download/?$", views.BimSqliteDownloadView.as_view(), name='bim-sqlite-download'),
    re_path(r"^bim-dbid-objects/?$", views.BimObjectDbidView.as_view(), name='bim-dbid-objects'),

    path('', include(router.urls)),
]

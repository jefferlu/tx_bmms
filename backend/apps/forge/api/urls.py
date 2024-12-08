from django.urls import path, include, re_path
from django.views.decorators.csrf import csrf_exempt

from . import views

urlpatterns = [
    re_path(r'^buckets/?$', views.BucketView.as_view(), name='buckets'),
    re_path(r'^objects/?$', views.ObjectView.as_view(), name='objects'),
    re_path(r'^bim-data-import/?$', views.BimDataImportView.as_view(), name='bim_data_import'),
]

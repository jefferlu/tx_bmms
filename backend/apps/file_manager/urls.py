"""
檔案管理系統 URL 配置
"""
from django.urls import path
from .views import (
    FileManagerListView,
    FileUploadView,
    FileActionView,
    FileDownloadView,
    FilePermissionsView
)


app_name = 'file_manager'

urlpatterns = [
    path('list/', FileManagerListView.as_view(), name='list'),
    path('upload/', FileUploadView.as_view(), name='upload'),
    path('action/', FileActionView.as_view(), name='action'),
    path('download/', FileDownloadView.as_view(), name='download'),
    path('permissions/', FilePermissionsView.as_view(), name='permissions'),
]

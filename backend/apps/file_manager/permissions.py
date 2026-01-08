"""
檔案管理系統權限模組
"""
from rest_framework import permissions


class FileManagerPermission(permissions.BasePermission):
    """
    檔案管理器權限類

    權限規則:
    - GET 請求需要 'file_manager.view_files' 權限
    - POST, PUT, PATCH, DELETE 請求需要 'file_manager.edit_files' 權限
    """

    VIEW_FILES_PERMISSION = 'file_manager.view_files'
    EDIT_FILES_PERMISSION = 'file_manager.edit_files'

    def has_permission(self, request, view):
        """
        檢查使用者是否有權限執行操作
        """
        # 必須是已認證使用者
        if not request.user or not request.user.is_authenticated:
            return False

        # GET, HEAD, OPTIONS 需要檢視權限
        if request.method in permissions.SAFE_METHODS:
            return request.user.has_perm(self.VIEW_FILES_PERMISSION)

        # POST, PUT, PATCH, DELETE 需要編輯權限
        return request.user.has_perm(self.EDIT_FILES_PERMISSION)

    @staticmethod
    def can_view_files(user) -> bool:
        """檢查使用者是否有檢視權限"""
        return user.is_authenticated and user.has_perm('file_manager.view_files')

    @staticmethod
    def can_edit_files(user) -> bool:
        """檢查使用者是否有編輯權限"""
        return user.is_authenticated and user.has_perm('file_manager.edit_files')

"""
檔案管理系統 Views
"""
import os
import shutil
from datetime import datetime
from pathlib import Path
from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .security import (
    FileSecurityValidator,
    PathTraversalError,
    FileNotAllowedError,
    FileSizeExceededError,
    FileAlreadyExistsError
)
from .permissions import FileManagerPermission
from .serializers import (
    FileListResponseSerializer,
    UploadResponseSerializer,
    ActionRequestSerializer,
    ActionResponseSerializer,
    PermissionResponseSerializer
)


class FileManagerListView(APIView):
    """
    檔案列表視圖
    GET /api/file-manager/list/?path=<relative_path>
    """
    permission_classes = [FileManagerPermission]

    def get(self, request):
        """
        取得指定目錄的檔案列表
        """
        try:
            # 取得相對路徑參數
            relative_path = request.query_params.get('path', '')

            # 驗證路徑安全性
            abs_path = FileSecurityValidator.get_safe_path(relative_path)

            # 檢查目錄是否存在
            if not abs_path.exists():
                return Response(
                    {'error': 'Directory not found'},
                    status=status.HTTP_404_NOT_FOUND
                )

            if not abs_path.is_dir():
                return Response(
                    {'error': 'Path is not a directory'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 取得目錄內容
            items = []
            for item in abs_path.iterdir():
                try:
                    stat = item.stat()
                    item_info = {
                        'name': item.name,
                        'type': 'directory' if item.is_dir() else 'file',
                        'size': stat.st_size if item.is_file() else None,
                        'modified_time': datetime.fromtimestamp(
                            stat.st_mtime,
                            tz=timezone.get_current_timezone()
                        ),
                        'created_time': datetime.fromtimestamp(
                            stat.st_ctime,
                            tz=timezone.get_current_timezone()
                        ),
                        'path': str(item.relative_to(FileSecurityValidator.STORAGE_ROOT)),
                        'is_writable': os.access(item, os.W_OK)
                    }
                    items.append(item_info)
                except (OSError, PermissionError):
                    # 跳過無法存取的項目
                    continue

            # 排序: 資料夾優先,然後按名稱排序
            items.sort(key=lambda x: (x['type'] != 'directory', x['name'].lower()))

            # 取得使用者權限
            permissions = {
                'can_read': FileManagerPermission.can_view_files(request.user),
                'can_write': FileManagerPermission.can_edit_files(request.user)
            }

            # 回傳結果
            response_data = {
                'current_path': relative_path,
                'items': items,
                'permissions': permissions
            }

            return Response(response_data, status=status.HTTP_200_OK)

        except PathTraversalError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': f'Internal server error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class FileUploadView(APIView):
    """
    檔案上傳視圖
    POST /api/file-manager/upload/
    """
    permission_classes = [FileManagerPermission]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        """
        上傳檔案到指定目錄
        """
        try:
            # 取得目標路徑
            relative_path = request.data.get('path', '')
            abs_path = FileSecurityValidator.get_safe_path(relative_path)

            # 確保目標目錄存在
            abs_path.mkdir(parents=True, exist_ok=True)

            # 取得上傳的檔案
            files = request.FILES.getlist('file')
            if not files:
                return Response(
                    {'error': 'No files provided'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            uploaded_files = []
            failed_files = []

            for uploaded_file in files:
                try:
                    # 驗證檔案名稱
                    FileSecurityValidator.validate_filename(uploaded_file.name)

                    # 驗證檔案大小
                    FileSecurityValidator.validate_file_size(uploaded_file.size)

                    # 目標檔案路徑
                    target_path = abs_path / uploaded_file.name

                    # 檢查檔案是否已存在
                    if target_path.exists():
                        failed_files.append({
                            'name': uploaded_file.name,
                            'message': 'File already exists'
                        })
                        continue

                    # 儲存檔案
                    with open(target_path, 'wb+') as destination:
                        for chunk in uploaded_file.chunks():
                            destination.write(chunk)

                    uploaded_files.append({
                        'name': uploaded_file.name,
                        'path': str(target_path.relative_to(FileSecurityValidator.STORAGE_ROOT)),
                        'size': uploaded_file.size,
                        'message': 'File uploaded successfully'
                    })

                except (FileNotAllowedError, FileSizeExceededError) as e:
                    failed_files.append({
                        'name': uploaded_file.name,
                        'message': str(e)
                    })
                except Exception as e:
                    failed_files.append({
                        'name': uploaded_file.name,
                        'message': f'Upload failed: {str(e)}'
                    })

            response_data = {
                'success': len(uploaded_files) > 0,
                'uploaded_files': uploaded_files,
                'failed_files': failed_files
            }

            return Response(response_data, status=status.HTTP_200_OK)

        except PathTraversalError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': f'Internal server error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class FileActionView(APIView):
    """
    檔案操作視圖 (重新命名、刪除、移動、建立資料夾)
    POST /api/file-manager/action/
    """
    permission_classes = [FileManagerPermission]
    parser_classes = [JSONParser]

    def post(self, request):
        """
        執行檔案操作
        """
        # 驗證請求資料
        serializer = ActionRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )

        data = serializer.validated_data
        action = data['action']

        try:
            if action == 'rename':
                return self._handle_rename(data)
            elif action == 'delete':
                return self._handle_delete(data)
            elif action == 'move':
                return self._handle_move(data)
            elif action == 'mkdir':
                return self._handle_mkdir(data)
            else:
                return Response(
                    {'error': f'Unknown action: {action}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        except PathTraversalError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except FileNotAllowedError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except FileAlreadyExistsError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_409_CONFLICT
            )
        except Exception as e:
            return Response(
                {'error': f'Internal server error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _handle_rename(self, data):
        """處理重新命名操作"""
        path = data['path']
        new_name = data['new_name']

        # 驗證新檔案名稱
        FileSecurityValidator.validate_filename(new_name)

        # 取得來源路徑
        source_path = FileSecurityValidator.get_safe_path(path)

        if not source_path.exists():
            return Response(
                {'error': 'Source path not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # 建構目標路徑
        target_path = source_path.parent / new_name

        if target_path.exists():
            raise FileAlreadyExistsError('Target name already exists')

        # 重新命名
        source_path.rename(target_path)

        stat = target_path.stat()
        item_info = {
            'name': target_path.name,
            'path': str(target_path.relative_to(FileSecurityValidator.STORAGE_ROOT)),
            'type': 'directory' if target_path.is_dir() else 'file',
            'size': stat.st_size if target_path.is_file() else None,
            'modified_time': datetime.fromtimestamp(
                stat.st_mtime,
                tz=timezone.get_current_timezone()
            ),
            'created_time': datetime.fromtimestamp(
                stat.st_ctime,
                tz=timezone.get_current_timezone()
            ),
            'is_writable': os.access(target_path, os.W_OK)
        }

        return Response({
            'success': True,
            'action': 'rename',
            'message': 'Renamed successfully',
            'item': item_info
        }, status=status.HTTP_200_OK)

    def _handle_delete(self, data):
        """處理刪除操作"""
        path = data['path']

        # 取得目標路徑
        target_path = FileSecurityValidator.get_safe_path(path)

        if not target_path.exists():
            return Response(
                {'error': 'Path not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # 刪除檔案或目錄
        if target_path.is_dir():
            shutil.rmtree(target_path)
        else:
            target_path.unlink()

        return Response({
            'success': True,
            'action': 'delete',
            'message': 'Deleted successfully'
        }, status=status.HTTP_200_OK)

    def _handle_move(self, data):
        """處理移動操作"""
        path = data['path']
        new_path = data['new_path']

        # 取得來源和目標路徑
        source_path = FileSecurityValidator.get_safe_path(path)
        target_path = FileSecurityValidator.get_safe_path(new_path)

        if not source_path.exists():
            return Response(
                {'error': 'Source path not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if target_path.exists():
            raise FileAlreadyExistsError('Target path already exists')

        # 確保目標目錄存在
        target_path.parent.mkdir(parents=True, exist_ok=True)

        # 移動檔案或目錄
        shutil.move(str(source_path), str(target_path))

        stat = target_path.stat()
        item_info = {
            'name': target_path.name,
            'path': str(target_path.relative_to(FileSecurityValidator.STORAGE_ROOT)),
            'type': 'directory' if target_path.is_dir() else 'file',
            'size': stat.st_size if target_path.is_file() else None,
            'modified_time': datetime.fromtimestamp(
                stat.st_mtime,
                tz=timezone.get_current_timezone()
            ),
            'created_time': datetime.fromtimestamp(
                stat.st_ctime,
                tz=timezone.get_current_timezone()
            ),
            'is_writable': os.access(target_path, os.W_OK)
        }

        return Response({
            'success': True,
            'action': 'move',
            'message': 'Moved successfully',
            'item': item_info
        }, status=status.HTTP_200_OK)

    def _handle_mkdir(self, data):
        """處理建立資料夾操作"""
        path = data['path']
        new_name = data['new_name']

        # 驗證資料夾名稱
        FileSecurityValidator.validate_filename(new_name)

        # 取得父目錄路徑
        parent_path = FileSecurityValidator.get_safe_path(path)

        # 建構新資料夾路徑
        new_dir_path = parent_path / new_name

        if new_dir_path.exists():
            raise FileAlreadyExistsError('Directory already exists')

        # 建立資料夾
        new_dir_path.mkdir(parents=True, exist_ok=False)

        stat = new_dir_path.stat()
        item_info = {
            'name': new_dir_path.name,
            'path': str(new_dir_path.relative_to(FileSecurityValidator.STORAGE_ROOT)),
            'type': 'directory',
            'size': None,
            'modified_time': datetime.fromtimestamp(
                stat.st_mtime,
                tz=timezone.get_current_timezone()
            ),
            'created_time': datetime.fromtimestamp(
                stat.st_ctime,
                tz=timezone.get_current_timezone()
            ),
            'is_writable': os.access(new_dir_path, os.W_OK)
        }

        return Response({
            'success': True,
            'action': 'mkdir',
            'message': 'Directory created successfully',
            'item': item_info
        }, status=status.HTTP_200_OK)


class FileDownloadView(APIView):
    """
    檔案下載視圖
    GET /api/file-manager/download/?path=<relative_path>
    """
    permission_classes = [FileManagerPermission]

    def get(self, request):
        """
        下載指定檔案
        """
        try:
            # 取得檔案路徑
            relative_path = request.query_params.get('path', '')
            if not relative_path:
                return Response(
                    {'error': 'Path parameter is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 驗證路徑安全性
            file_path = FileSecurityValidator.get_safe_path(relative_path)

            # 檢查檔案是否存在
            if not file_path.exists():
                raise Http404('File not found')

            # 檢查是否為檔案
            if not file_path.is_file():
                return Response(
                    {'error': 'Path is not a file'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 取得 MIME 類型
            mime_type, _ = FileSecurityValidator.validate_mime_type(file_path)

            # 回傳檔案
            response = FileResponse(
                open(file_path, 'rb'),
                content_type=mime_type
            )
            response['Content-Disposition'] = f'attachment; filename="{file_path.name}"'

            return response

        except PathTraversalError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Http404:
            raise
        except Exception as e:
            return Response(
                {'error': f'Internal server error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class FilePermissionsView(APIView):
    """
    權限查詢視圖
    GET /api/file-manager/permissions/
    """
    permission_classes = [FileManagerPermission]

    def get(self, request):
        """
        取得當前使用者的檔案管理權限
        """
        permissions = {
            'can_read': FileManagerPermission.can_view_files(request.user),
            'can_write': FileManagerPermission.can_edit_files(request.user)
        }

        return Response(permissions, status=status.HTTP_200_OK)

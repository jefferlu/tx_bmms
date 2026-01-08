"""
檔案管理系統安全性模組
提供路徑驗證、檔案類型檢查等安全防護機制
"""
import os
import mimetypes
from pathlib import Path
from typing import Tuple
from django.conf import settings


class FileSecurityError(Exception):
    """檔案安全性相關錯誤的基礎異常類"""
    pass


class PathTraversalError(FileSecurityError):
    """路徑遍歷攻擊錯誤"""
    pass


class FileNotAllowedError(FileSecurityError):
    """檔案類型不允許錯誤"""
    pass


class FileSizeExceededError(FileSecurityError):
    """檔案大小超限錯誤"""
    pass


class FileAlreadyExistsError(FileSecurityError):
    """檔案已存在錯誤"""
    pass


class FileSecurityValidator:
    """檔案安全性驗證器"""

    # 黑名單副檔名
    BLOCKED_EXTENSIONS = {
        '.php', '.exe', '.sh', '.bat', '.com', '.pif', '.scr',
        '.asp', '.aspx', '.jsp', '.py', '.rb', '.pl', '.cgi'
    }

    # 最大檔案大小 (預設 100MB)
    MAX_FILE_SIZE = getattr(settings, 'FILE_MANAGER_MAX_FILE_SIZE', 100 * 1024 * 1024)

    # 儲存根目錄
    STORAGE_ROOT = Path(getattr(settings, 'FILE_MANAGER_STORAGE_ROOT',
                                 os.path.join(settings.MEDIA_ROOT, 'storage')))

    @classmethod
    def get_storage_root(cls) -> Path:
        """取得儲存根目錄路徑"""
        return cls.STORAGE_ROOT

    @classmethod
    def validate_path(cls, relative_path: str) -> Path:
        """
        驗證路徑安全性

        Args:
            relative_path: 相對於 storage root 的路徑

        Returns:
            Path: 驗證後的絕對路徑

        Raises:
            PathTraversalError: 如果路徑包含路徑遍歷攻擊
        """
        # 移除開頭的斜線
        relative_path = relative_path.lstrip('/')

        # 建構絕對路徑
        absolute_path = (cls.STORAGE_ROOT / relative_path).resolve()

        # 確保解析後的路徑仍在 storage root 內
        try:
            absolute_path.relative_to(cls.STORAGE_ROOT.resolve())
        except ValueError:
            raise PathTraversalError(
                f"Path traversal detected: {relative_path}"
            )

        return absolute_path

    @classmethod
    def validate_filename(cls, filename: str) -> None:
        """
        驗證檔案名稱安全性

        Args:
            filename: 檔案名稱

        Raises:
            FileNotAllowedError: 如果檔案類型不允許
        """
        # 取得副檔名
        _, ext = os.path.splitext(filename.lower())

        # 檢查是否在黑名單中
        if ext in cls.BLOCKED_EXTENSIONS:
            raise FileNotAllowedError(
                f"File extension '{ext}' is not allowed"
            )

        # 檢查是否包含路徑分隔符
        if '/' in filename or '\\' in filename:
            raise FileNotAllowedError(
                "Filename cannot contain path separators"
            )

        # 檢查是否為隱藏檔案或特殊檔案
        if filename.startswith('.'):
            raise FileNotAllowedError(
                "Hidden files are not allowed"
            )

    @classmethod
    def validate_file_size(cls, file_size: int) -> None:
        """
        驗證檔案大小

        Args:
            file_size: 檔案大小 (bytes)

        Raises:
            FileSizeExceededError: 如果檔案過大
        """
        if file_size > cls.MAX_FILE_SIZE:
            max_mb = cls.MAX_FILE_SIZE / (1024 * 1024)
            actual_mb = file_size / (1024 * 1024)
            raise FileSizeExceededError(
                f"File size ({actual_mb:.2f}MB) exceeds maximum allowed size ({max_mb:.2f}MB)"
            )

    @classmethod
    def validate_mime_type(cls, file_path: Path) -> Tuple[str, str]:
        """
        驗證檔案 MIME 類型

        Args:
            file_path: 檔案路徑

        Returns:
            Tuple[str, str]: (mime_type, encoding)
        """
        mime_type, encoding = mimetypes.guess_type(str(file_path))
        return mime_type or 'application/octet-stream', encoding

    @classmethod
    def ensure_storage_exists(cls) -> None:
        """確保儲存目錄存在"""
        cls.STORAGE_ROOT.mkdir(parents=True, exist_ok=True)

    @classmethod
    def get_safe_path(cls, relative_path: str) -> Path:
        """
        取得安全的檔案路徑 (結合驗證與確保存在)

        Args:
            relative_path: 相對路徑

        Returns:
            Path: 安全的絕對路徑
        """
        cls.ensure_storage_exists()
        return cls.validate_path(relative_path)

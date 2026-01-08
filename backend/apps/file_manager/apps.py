from django.apps import AppConfig


class FileManagerConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.file_manager'
    verbose_name = '檔案管理系統'

    def ready(self):
        """
        應用初始化時執行
        """
        pass

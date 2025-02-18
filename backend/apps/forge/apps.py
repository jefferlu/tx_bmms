from django.apps import AppConfig


class ForgeConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.forge'

    def ready(self):
        import apps.forge.signals
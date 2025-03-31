from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/progress/?$', consumers.ProgressConsumer.as_asgi()),
    re_path(r'ws/update-category/?$', consumers.UpdateCategoryConsumer.as_asgi()),  # 
]

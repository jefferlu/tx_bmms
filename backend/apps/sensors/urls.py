from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SensorViewSet, SensorBimBindingViewSet

router = DefaultRouter()
router.register(r'sensors', SensorViewSet, basename='sensor')
router.register(r'bindings', SensorBimBindingViewSet, basename='binding')

urlpatterns = [
    path('', include(router.urls)),
]

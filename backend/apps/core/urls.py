from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UnitViewSet, SlotViewSet, AllocationViewSet

router = DefaultRouter()
router.register(r"units", UnitViewSet, basename="units")
router.register(r"slots", SlotViewSet, basename="slots")
router.register(r"allocations", AllocationViewSet, basename="allocations")

urlpatterns = [
    path("", include(router.urls)),
]

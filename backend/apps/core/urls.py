from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UnitViewSet,
    SlotViewSet,
    AllocationViewSet,
    auth_login,
    auth_logout,
    auth_me,
    auth_csrf,
)

router = DefaultRouter()
router.register(r"units", UnitViewSet, basename="units")
router.register(r"slots", SlotViewSet, basename="slots")
router.register(r"allocations", AllocationViewSet, basename="allocations")

urlpatterns = [
    path("auth/login/", auth_login),
    path("auth/logout/", auth_logout),
    path("auth/me/", auth_me),
    path("auth/csrf/", auth_csrf),
    path("", include(router.urls)),
]

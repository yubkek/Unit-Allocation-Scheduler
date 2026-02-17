from django.contrib.auth import authenticate, login, logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.status import HTTP_401_UNAUTHORIZED
from .models import Unit, Slot, Allocation
from .serializers import UnitSerializer, SlotSerializer, AllocationSerializer


# --- Auth (no auth required on these) ---
@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def auth_login(request):
    username = request.data.get("username") or ""
    password = request.data.get("password") or ""
    user = authenticate(request, username=username.strip(), password=password)
    if user is None:
        return Response({"detail": "Invalid username or password."}, status=HTTP_401_UNAUTHORIZED)
    login(request, user)
    return Response({"id": user.pk, "username": user.username})


@csrf_exempt
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def auth_logout(request):
    logout(request)
    return Response(status=204)


@api_view(["GET"])
@permission_classes([AllowAny])
def auth_me(request):
    if not request.user.is_authenticated:
        return Response({"detail": "Not authenticated."}, status=HTTP_401_UNAUTHORIZED)
    return Response({"id": request.user.pk, "username": request.user.username})


@ensure_csrf_cookie
@api_view(["GET"])
@permission_classes([AllowAny])
def auth_csrf(request):
    """Ensure the CSRF cookie is set for the SPA (frontend fetch uses credentials: 'include')."""
    return Response({"detail": "CSRF cookie set"})


@method_decorator(csrf_exempt, name="dispatch")
class UnitViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Unit.objects.all().order_by("code")
    serializer_class = UnitSerializer


@method_decorator(csrf_exempt, name="dispatch")
class SlotViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Slot.objects.all().order_by("day", "start_time")
    serializer_class = SlotSerializer


@method_decorator(csrf_exempt, name="dispatch")
class AllocationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Allocation.objects.select_related("unit", "slot").all().order_by("-created_at")
    serializer_class = AllocationSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(serializer.data, status=201)

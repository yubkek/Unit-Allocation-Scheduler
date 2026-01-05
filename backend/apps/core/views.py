from rest_framework import viewsets
from rest_framework.response import Response
from .models import Unit, Slot, Allocation
from .serializers import UnitSerializer, SlotSerializer, AllocationSerializer


class UnitViewSet(viewsets.ModelViewSet):
    queryset = Unit.objects.all().order_by("code")
    serializer_class = UnitSerializer


class SlotViewSet(viewsets.ModelViewSet):
    queryset = Slot.objects.all().order_by("day", "start_time")
    serializer_class = SlotSerializer


class AllocationViewSet(viewsets.ModelViewSet):
    queryset = Allocation.objects.select_related("unit", "slot").all().order_by("-created_at")
    serializer_class = AllocationSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(serializer.data, status=201)

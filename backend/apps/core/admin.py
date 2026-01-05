from django.contrib import admin
from .models import Unit, Slot, Allocation

@admin.register(Unit)
class UnitAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "capacity")
    search_fields = ("code", "name")

@admin.register(Slot)
class SlotAdmin(admin.ModelAdmin):
    list_display = ("day", "start_time", "end_time")
    list_filter = ("day",)

@admin.register(Allocation)
class AllocationAdmin(admin.ModelAdmin):
    list_display = ("unit", "slot", "created_at")
    raw_id_fields = ("unit", "slot")

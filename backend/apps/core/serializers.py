from rest_framework import serializers
from .models import Unit, Slot, Allocation

class UnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unit
        fields = ["id", "code", "name", "capacity"]

class SlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = Slot
        fields = ["id", "day", "start_time", "end_time"]

class AllocationSerializer(serializers.ModelSerializer):
    unit = UnitSerializer(read_only=True)
    slot = SlotSerializer(read_only=True)
    unit_id = serializers.PrimaryKeyRelatedField(queryset=Unit.objects.all(), source="unit", write_only=True)
    slot_id = serializers.PrimaryKeyRelatedField(queryset=Slot.objects.all(), source="slot", write_only=True)

    class Meta:
        model = Allocation
        fields = ["id", "unit", "slot", "unit_id", "slot_id", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        """Prevent slot clashes: a Slot may only have one Allocation."""
        slot = attrs.get("slot") or (self.instance.slot if self.instance else None)
        # creation
        if self.instance is None:
            if Allocation.objects.filter(slot=slot).exists():
                raise serializers.ValidationError({"slot_id": "Slot already allocated (clash)."})
        else:
            # update: if changing slot, ensure no other allocation occupies it
            if "slot" in attrs and Allocation.objects.filter(slot=slot).exclude(pk=self.instance.pk).exists():
                raise serializers.ValidationError({"slot_id": "Slot already allocated (clash)."})
        return attrs

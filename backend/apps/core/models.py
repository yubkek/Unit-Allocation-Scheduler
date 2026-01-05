from django.db import models

DAYS = [
    ("Mon", "Monday"),
    ("Tue", "Tuesday"),
    ("Wed", "Wednesday"),
    ("Thu", "Thursday"),
    ("Fri", "Friday"),
    ("Sat", "Saturday"),
    ("Sun", "Sunday"),
]

class Unit(models.Model):
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=200)
    capacity = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.code} - {self.name}"

class Slot(models.Model):
    day = models.CharField(max_length=3, choices=DAYS)
    start_time = models.TimeField()
    end_time = models.TimeField()

    class Meta:
        unique_together = ("day", "start_time", "end_time")

    def __str__(self):
        return f"{self.get_day_display()} {self.start_time.strftime('%H:%M')}-{self.end_time.strftime('%H:%M')}"

class Allocation(models.Model):
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name="allocations")
    slot = models.ForeignKey(Slot, on_delete=models.CASCADE, related_name="allocations")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("unit", "slot")

    def __str__(self):
        return f"{self.unit.code} -> {self.slot}"

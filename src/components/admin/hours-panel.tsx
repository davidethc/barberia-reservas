"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateBusinessHours } from "@/app/actions/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { DAY_NAMES } from "@/lib/constants";
import type { Database } from "@/types/database";

type BusinessHours = Database["public"]["Tables"]["business_hours"]["Row"];

export function HoursPanel({ initialHours }: { initialHours: BusinessHours[] }) {
  const days = [...initialHours].sort((a, b) => a.day_of_week - b.day_of_week);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Horario de atención</h2>
      <div className="space-y-2">
        {days.map((day) => (
          <DayRow key={day.day_of_week} day={day} />
        ))}
        {days.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay horarios configurados
          </p>
        )}
      </div>
    </div>
  );
}

function DayRow({ day }: { day: BusinessHours }) {
  const [isOpen, setIsOpen] = useState(day.is_open ?? true);
  const [openTime, setOpenTime] = useState(day.open_time.slice(0, 5));
  const [closeTime, setCloseTime] = useState(day.close_time.slice(0, 5));
  const [isDirty, setIsDirty] = useState(false);
  const [isPending, startTransition] = useTransition();

  function markDirty() {
    setIsDirty(true);
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateBusinessHours({
        dayOfWeek: day.day_of_week,
        openTime,
        closeTime,
        isOpen,
      });
      if (result.success) {
        toast.success(`${DAY_NAMES[day.day_of_week]} actualizado`);
        setIsDirty(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleToggleOpen(checked: boolean) {
    setIsOpen(checked);
    setIsDirty(true);
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-28 items-center gap-2">
          <Switch checked={isOpen} onCheckedChange={handleToggleOpen} aria-label="Abierto" />
          <span className="text-sm font-medium">{DAY_NAMES[day.day_of_week]}</span>
        </div>

        <div className="flex flex-1 items-center gap-2">
          <Input
            type="time"
            value={openTime}
            disabled={!isOpen}
            onChange={(e) => {
              setOpenTime(e.target.value);
              markDirty();
            }}
            className="h-9 w-auto"
          />
          <span className="text-sm text-muted-foreground">a</span>
          <Input
            type="time"
            value={closeTime}
            disabled={!isOpen}
            onChange={(e) => {
              setCloseTime(e.target.value);
              markDirty();
            }}
            className="h-9 w-auto"
          />
        </div>

        <Button
          size="sm"
          variant={isDirty ? "default" : "outline"}
          disabled={!isDirty || isPending}
          onClick={handleSave}
        >
          {isPending ? "Guardando..." : "Guardar"}
        </Button>
      </CardContent>
    </Card>
  );
}

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
      <h2 className="font-heading text-lg font-semibold">Horario de atención</h2>

      {days.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-4 py-12 text-center">
          <p className="text-sm font-medium text-foreground">No hay horarios configurados</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Sin horario de atención la web no ofrece ningún turno. Carga los siete días en
            Supabase y vuelve a entrar para ajustarlos desde aquí.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {days.map((day) => (
              <DayRow key={day.day_of_week} day={day} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Cada día se guarda por separado. El botón se activa cuando hay algo sin guardar.
          </p>
        </>
      )}
    </div>
  );
}

function DayRow({ day }: { day: BusinessHours }) {
  const [isOpen, setIsOpen] = useState(day.is_open ?? true);
  const [openTime, setOpenTime] = useState(day.open_time.slice(0, 5));
  const [closeTime, setCloseTime] = useState(day.close_time.slice(0, 5));
  const [isDirty, setIsDirty] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isValid = closeTime > openTime;

  function handleSave() {
    if (!isValid) return;

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

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <label className="flex h-11 items-center gap-2.5 sm:h-9">
            <Switch
              checked={isOpen}
              onCheckedChange={(checked) => {
                setIsOpen(checked);
                setIsDirty(true);
              }}
              aria-label={`Abierto: ${DAY_NAMES[day.day_of_week]}`}
            />
            <span className="text-sm font-medium">{DAY_NAMES[day.day_of_week]}</span>
          </label>

          <span className="text-sm text-muted-foreground">
            {isOpen ? `${openTime} a ${closeTime}` : "Cerrado"}
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-0 flex-1 items-end gap-2">
            <Input
              type="time"
              aria-label={`Apertura ${DAY_NAMES[day.day_of_week]}`}
              value={openTime}
              disabled={!isOpen}
              onChange={(e) => {
                setOpenTime(e.target.value);
                setIsDirty(true);
              }}
              className="h-11 min-w-0 flex-1 sm:h-9"
            />
            <span className="pb-3 text-sm text-muted-foreground sm:pb-2">a</span>
            <Input
              type="time"
              aria-label={`Cierre ${DAY_NAMES[day.day_of_week]}`}
              value={closeTime}
              disabled={!isOpen}
              onChange={(e) => {
                setCloseTime(e.target.value);
                setIsDirty(true);
              }}
              className="h-11 min-w-0 flex-1 sm:h-9"
            />
          </div>

          <Button
            variant={isDirty ? "default" : "outline"}
            disabled={!isDirty || !isValid || isPending}
            onClick={handleSave}
            className="h-11 sm:h-9"
          >
            {isPending ? "Guardando..." : "Guardar"}
          </Button>
        </div>

        {!isValid && (
          <p className="text-xs text-destructive">
            La hora de cierre tiene que ser posterior a la de apertura.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

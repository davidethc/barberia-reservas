"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  getAgendaForDate,
  completeAppointment,
  cancelAppointment,
  createBlock,
  deleteBlock,
  type AgendaAppointment,
  type AgendaBlock,
  type AgendaDay,
} from "@/app/actions/agenda";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/staff/confirm-dialog";
import { FULL_DAY_START, FULL_DAY_END } from "@/lib/constants";
import { shopToday as todayStr } from "@/lib/shop-date";
import { addMinutesToTime, formatDate, formatPrice, formatTime, cn } from "@/lib/utils";
import { Ban, CalendarOff, ChevronLeft, ChevronRight, Phone, Trash2 } from "lucide-react";

function shiftDate(dateStr: string, days: number): string {
  // Anchored at UTC noon so the arithmetic never crosses a day boundary.
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  completed: "Completado",
  cancelled: "Cancelado",
  no_show: "No asistió",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  completed: "default",
  cancelled: "secondary",
  no_show: "destructive",
};

/** Postgres hands back `HH:MM:SS`; the constants are `HH:MM`, so compare on the same shape. */
function isFullDay(block: AgendaBlock): boolean {
  return (
    block.start_time.slice(0, 5) <= FULL_DAY_START && block.end_time.slice(0, 5) >= FULL_DAY_END
  );
}

function clampToDay(time: string): string {
  return time > FULL_DAY_END ? FULL_DAY_END : time;
}

function dayCountLabel(pending: number, total: number): string {
  if (total === 0) return "Sin turnos";
  const turnos = total === 1 ? "1 turno" : `${total} turnos`;
  return pending > 0 ? `${turnos} · ${pending} por atender` : `${turnos} · todo cerrado`;
}

type TimelineItem =
  | { kind: "appointment"; id: string; at: string; appointment: AgendaAppointment }
  | { kind: "block"; id: string; at: string; block: AgendaBlock };

function buildTimeline(day: AgendaDay): TimelineItem[] {
  const items: TimelineItem[] = [
    ...day.appointments.map<TimelineItem>((a) => ({
      kind: "appointment",
      id: a.id,
      at: a.start_time,
      appointment: a,
    })),
    ...day.blocks.map<TimelineItem>((b) => ({
      kind: "block",
      id: b.id,
      at: b.start_time,
      block: b,
    })),
  ];

  return items.sort((a, b) => a.at.localeCompare(b.at));
}

export function AgendaView({
  initialDate,
  initialDay,
  barberId,
}: {
  initialDate: string;
  initialDay: AgendaDay;
  barberId: string;
}) {
  const [date, setDate] = useState(initialDate);
  const [day, setDay] = useState(initialDay);
  const dateRef = useRef(date);
  const [isLoading, startLoading] = useTransition();
  const [isMutating, startMutating] = useTransition();
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  // Cancelling and marking a no-show cannot be undone, so both pass through a confirmation.
  const [closing, setClosing] = useState<{
    id: string;
    reason: "cancelled" | "no_show";
  } | null>(null);

  function loadDate(nextDate: string) {
    setDate(nextDate);
    dateRef.current = nextDate;
    startLoading(async () => {
      const result = await getAgendaForDate(nextDate);
      if (result.success) {
        setDay(result.data);
      } else {
        toast.error(result.error);
        setDay({ appointments: [], blocks: [] });
      }
    });
  }

  // Same fetch as loadDate, but without the skeleton flash — used when a realtime
  // event says the day on screen changed instead of when the barber navigates.
  function refreshQuietly(forDate: string) {
    getAgendaForDate(forDate).then((result) => {
      if (result.success && dateRef.current === forDate) {
        setDay(result.data);
      }
    });
  }

  // A client booking, another device completing a turn, or a block created elsewhere
  // must show up here without the barber having to reload the page.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`agenda-${barberId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "appointments",
          filter: `barber_id=eq.${barberId}`,
        },
        (payload) => {
          const row = payload.new as { date: string; start_time: string };
          if (row.date !== dateRef.current) return;
          toast.info(`Nuevo turno reservado a las ${formatTime(row.start_time)}`);
          refreshQuietly(row.date);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "appointments",
          filter: `barber_id=eq.${barberId}`,
        },
        (payload) => {
          const row = payload.new as { date: string };
          if (row.date === dateRef.current) refreshQuietly(row.date);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "barber_schedules",
          filter: `barber_id=eq.${barberId}`,
        },
        // A delete only carries the row's id (no REPLICA IDENTITY FULL), so there's no
        // date on the payload to check — just re-pull whatever day is on screen.
        () => refreshQuietly(dateRef.current)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [barberId]);

  function handleCancel(id: string, reason: "cancelled" | "no_show") {
    startMutating(async () => {
      const result = await cancelAppointment({ appointmentId: id, reason });
      if (result.success) {
        toast.success(reason === "cancelled" ? "Turno cancelado" : "Marcado como no asistió");
        setDay((prev) => ({
          ...prev,
          appointments: prev.appointments.map((a) =>
            a.id === id ? { ...a, status: reason } : a
          ),
        }));
        setClosing(null);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleCompleted(id: string, paymentMethod: "cash" | "transfer", amount: number) {
    startMutating(async () => {
      const result = await completeAppointment({ appointmentId: id, paymentMethod, amount });
      if (result.success) {
        toast.success("Turno completado");
        setDay((prev) => ({
          ...prev,
          appointments: prev.appointments.map((a) =>
            a.id === id ? { ...a, status: "completed" } : a
          ),
        }));
        setCompletingId(null);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleCreateBlock(startTime: string, endTime: string) {
    startMutating(async () => {
      const result = await createBlock({ date, startTime, endTime });
      if (result.success) {
        const block = result.data;
        toast.success(isFullDay(block) ? "Día bloqueado" : "Horario bloqueado");
        setDay((prev) => ({ ...prev, blocks: [...prev.blocks, block] }));
        setIsBlockDialogOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDeleteBlock(id: string) {
    startMutating(async () => {
      const result = await deleteBlock({ blockId: id });
      if (result.success) {
        toast.success("Bloqueo eliminado");
        setDay((prev) => ({ ...prev, blocks: prev.blocks.filter((b) => b.id !== id) }));
      } else {
        toast.error(result.error);
      }
    });
  }

  const completingAppointment = day.appointments.find((a) => a.id === completingId) ?? null;
  const isToday = date === todayStr();
  const timeline = buildTimeline(day);
  const blockCount = day.blocks.length;
  const pendingCount = day.appointments.filter((a) => a.status === "pending").length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button
          variant="outline"
          className="size-11 shrink-0"
          onClick={() => loadDate(shiftDate(date, -1))}
          aria-label="Día anterior"
        >
          <ChevronLeft className="size-5" />
        </Button>

        <div className="min-w-0 text-center">
          <div className="truncate text-lg font-semibold capitalize">
            {isToday ? "Hoy" : formatDate(date)}
          </div>
          <div className="text-xs text-muted-foreground">
            {isToday ? formatDate(date) : dayCountLabel(pendingCount, day.appointments.length)}
          </div>
        </div>

        <Button
          variant="outline"
          className="size-11 shrink-0"
          onClick={() => loadDate(shiftDate(date, 1))}
          aria-label="Día siguiente"
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>

      <div className="mb-6 space-y-2">
        {!isToday && (
          <Button
            variant="secondary"
            className="h-11 w-full"
            disabled={isLoading}
            onClick={() => loadDate(todayStr())}
          >
            Volver a hoy
          </Button>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {isToday ? dayCountLabel(pendingCount, day.appointments.length) : null}
            {isToday && blockCount > 0 && <span aria-hidden> · </span>}
            {blockCount === 1
              ? "1 bloqueo"
              : blockCount > 1
                ? `${blockCount} bloqueos`
                : !isToday
                  ? "Sin bloqueos este día"
                  : null}
          </p>
          <Button
            variant="outline"
            className="h-11 w-full gap-2 sm:w-auto"
            disabled={isLoading}
            onClick={() => setIsBlockDialogOpen(true)}
          >
            <Ban className="size-4" />
            Bloquear horario
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : timeline.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-4 py-16 text-center">
          <p className="text-sm font-medium text-foreground">No hay turnos este día</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Disfruta el descanso. Si no vas a atender, bloquea el día para que nadie reserve;
            con las flechas de arriba revisas otra fecha.
          </p>
          <Button
            variant="outline"
            className="mt-4 h-11 gap-2"
            onClick={() => setIsBlockDialogOpen(true)}
          >
            <Ban className="size-4" />
            Bloquear horario
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {timeline.map((item) =>
            item.kind === "appointment" ? (
              <AppointmentCard
                key={item.id}
                appointment={item.appointment}
                isMutating={isMutating}
                onComplete={() => setCompletingId(item.id)}
                onCancel={(reason) => setClosing({ id: item.id, reason })}
              />
            ) : (
              <BlockCard
                key={item.id}
                block={item.block}
                isMutating={isMutating}
                onDelete={() => handleDeleteBlock(item.id)}
              />
            )
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!closing}
        title={closing?.reason === "cancelled" ? "¿Cancelar este turno?" : "¿Marcar que no vino?"}
        description={
          closing?.reason === "cancelled"
            ? "El turno queda cancelado y el horario se libera. No se puede deshacer: si el cliente aparece, vas a tener que cargarlo de nuevo."
            : "Queda registrado como no asistió y no se cobra nada. No se puede deshacer."
        }
        confirmLabel={closing?.reason === "cancelled" ? "Sí, cancelar" : "Sí, no vino"}
        cancelLabel="Volver"
        pendingLabel="Guardando..."
        tone={closing?.reason === "cancelled" ? "destructive" : "default"}
        isPending={isMutating}
        onConfirm={() => closing && handleCancel(closing.id, closing.reason)}
        onOpenChange={(open) => {
          if (!open) setClosing(null);
        }}
      />

      <CompleteDialog
        appointment={completingAppointment}
        isPending={isMutating}
        onOpenChange={(open) => !open && setCompletingId(null)}
        onConfirm={handleCompleted}
      />

      <BlockDialog
        key={date}
        date={date}
        open={isBlockDialogOpen}
        isPending={isMutating}
        onOpenChange={setIsBlockDialogOpen}
        onConfirm={handleCreateBlock}
      />
    </div>
  );
}

function BlockCard({
  block,
  isMutating,
  onDelete,
}: {
  block: AgendaBlock;
  isMutating: boolean;
  onDelete: () => void;
}) {
  const fullDay = isFullDay(block);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {fullDay ? <CalendarOff className="size-5" /> : <Ban className="size-5" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="font-semibold tabular-nums">
          {fullDay
            ? "Todo el día"
            : `${formatTime(block.start_time)} – ${formatTime(block.end_time)}`}
        </div>
        <div className="text-xs text-muted-foreground">
          Bloqueado · nadie puede reservar este horario
        </div>
      </div>

      <Button
        variant="ghost"
        className="size-11 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        disabled={isMutating}
        onClick={onDelete}
        aria-label="Eliminar bloqueo"
      >
        <Trash2 className="size-5" />
      </Button>
    </div>
  );
}

function defaultStartTime(date: string): string {
  if (date !== todayStr()) return "09:00";

  const now = new Date();
  const rounded = Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30;
  if (rounded >= 23 * 60) return "23:00";
  return addMinutesToTime("00:00", rounded);
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const QUICK_DURATIONS = [
  { label: "30 min", minutes: 30 },
  { label: "1 h", minutes: 60 },
  { label: "2 h", minutes: 120 },
] as const;

function BlockDialog({
  date,
  open,
  isPending,
  onOpenChange,
  onConfirm,
}: {
  date: string;
  open: boolean;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (startTime: string, endTime: string) => void;
}) {
  const initialStart = defaultStartTime(date);
  const [startTime, setStartTime] = useState(initialStart);
  const [endTime, setEndTime] = useState(clampToDay(addMinutesToTime(initialStart, 60)));

  const isValid = TIME_PATTERN.test(startTime) && TIME_PATTERN.test(endTime) && endTime > startTime;

  function applyDuration(minutes: number) {
    setEndTime(clampToDay(addMinutesToTime(startTime, minutes)));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bloquear horario</DialogTitle>
          <DialogDescription>
            Nadie va a poder reservar en ese rango · {formatDate(date)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button
            type="button"
            variant="secondary"
            className="h-14 w-full justify-start gap-3 text-base"
            disabled={isPending}
            onClick={() => onConfirm(FULL_DAY_START, FULL_DAY_END)}
          >
            <CalendarOff className="size-5" />
            <span className="flex flex-col items-start leading-tight">
              <span className="font-semibold">Todo el día</span>
              <span className="text-xs font-normal text-muted-foreground">
                Bloquea la jornada completa
              </span>
            </span>
          </Button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">o un rango</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="block-start">Desde</Label>
              <Input
                id="block-start"
                type="time"
                className="h-11 w-full"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="block-end">Hasta</Label>
              <Input
                id="block-end"
                type="time"
                className="h-11 w-full"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            {QUICK_DURATIONS.map((duration) => (
              <Button
                key={duration.minutes}
                type="button"
                variant="outline"
                className="h-11 flex-1"
                disabled={isPending}
                onClick={() => applyDuration(duration.minutes)}
              >
                {duration.label}
              </Button>
            ))}
          </div>

          {!isValid && (
            <p className="text-xs text-destructive">
              La hora de fin tiene que ser posterior a la de inicio.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            className="h-11 w-full text-base"
            disabled={!isValid || isPending}
            onClick={() => onConfirm(startTime, endTime)}
          >
            {isPending ? "Guardando..." : "Bloquear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AppointmentCard({
  appointment,
  isMutating,
  onComplete,
  onCancel,
}: {
  appointment: AgendaAppointment;
  isMutating: boolean;
  onComplete: () => void;
  onCancel: (reason: "cancelled" | "no_show") => void;
}) {
  const isPending = appointment.status === "pending";

  return (
    <Card className={cn(!isPending && "opacity-70")}>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-bold tabular-nums">
              {formatTime(appointment.start_time)}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {appointment.services?.name ?? "Servicio"}
              {appointment.services?.price != null && (
                <> · {formatPrice(appointment.services.price)}</>
              )}
            </div>
          </div>
          <Badge variant={STATUS_VARIANT[appointment.status] ?? "outline"}>
            {STATUS_LABEL[appointment.status] ?? appointment.status}
          </Badge>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-lg bg-muted pl-3">
          <span className="min-w-0 truncate text-sm font-medium">
            {appointment.clients?.name ?? "Cliente"}
          </span>
          {appointment.clients?.phone && (
            <a
              href={`tel:${appointment.clients.phone}`}
              aria-label={`Llamar a ${appointment.clients.name ?? "el cliente"}`}
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-r-lg px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Phone className="size-4" />
              <span className="tabular-nums">{appointment.clients.phone}</span>
            </a>
          )}
        </div>

        {isPending && (
          <div className="flex flex-col gap-2">
            <Button
              onClick={onComplete}
              disabled={isMutating}
              className="h-12 w-full text-base"
            >
              Completar
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onCancel("no_show")}
                disabled={isMutating}
                className="h-11 flex-1"
              >
                No vino
              </Button>
              <Button
                variant="destructive"
                onClick={() => onCancel("cancelled")}
                disabled={isMutating}
                className="h-11 flex-1"
              >
                Cancelar turno
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CompleteDialog({
  appointment,
  isPending,
  onOpenChange,
  onConfirm,
}: {
  appointment: AgendaAppointment | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string, paymentMethod: "cash" | "transfer", amount: number) => void;
}) {
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer">("cash");
  const [amount, setAmount] = useState("");

  const defaultAmount = appointment?.services?.price ?? 0;
  const amountValue = amount === "" ? defaultAmount : Number(amount);
  const isValid = amountValue > 0;

  return (
    <Dialog
      open={!!appointment}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
          setPaymentMethod("cash");
          setAmount("");
        }
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Completar turno</DialogTitle>
          <DialogDescription>
            {appointment?.clients?.name} · {appointment?.services?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Método de pago</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={paymentMethod === "cash" ? "default" : "outline"}
                className="h-11 flex-1"
                onClick={() => setPaymentMethod("cash")}
              >
                Efectivo
              </Button>
              <Button
                type="button"
                variant={paymentMethod === "transfer" ? "default" : "outline"}
                className="h-11 flex-1"
                onClick={() => setPaymentMethod("transfer")}
              >
                Transferencia
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="amount">Monto</Label>
            <Input
              id="amount"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              className="h-11"
              placeholder={String(defaultAmount)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            className="h-11 w-full text-base"
            disabled={!isValid || isPending || !appointment}
            onClick={() => appointment && onConfirm(appointment.id, paymentMethod, amountValue)}
          >
            {isPending ? "Guardando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

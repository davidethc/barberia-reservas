"use client";

import { useState, useTransition } from "react";
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
import { FULL_DAY_START, FULL_DAY_END } from "@/lib/constants";
import { addMinutesToTime, formatDate, formatPrice, formatTime, cn } from "@/lib/utils";
import { Ban, CalendarOff, ChevronLeft, ChevronRight, Phone, Trash2 } from "lucide-react";

function todayStr(): string {
  return new Date().toISOString().split("T")[0]!;
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0]!;
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
}: {
  initialDate: string;
  initialDay: AgendaDay;
}) {
  const [date, setDate] = useState(initialDate);
  const [day, setDay] = useState(initialDay);
  const [isLoading, startLoading] = useTransition();
  const [isMutating, startMutating] = useTransition();
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);

  function loadDate(nextDate: string) {
    setDate(nextDate);
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="icon-lg"
          onClick={() => loadDate(shiftDate(date, -1))}
          aria-label="Día anterior"
        >
          <ChevronLeft className="size-5" />
        </Button>

        <div className="text-center">
          <div className="text-lg font-semibold capitalize">
            {isToday ? "Hoy" : formatDate(date)}
          </div>
          {!isToday && <div className="text-xs text-muted-foreground">{formatDate(date)}</div>}
        </div>

        <Button
          variant="outline"
          size="icon-lg"
          onClick={() => loadDate(shiftDate(date, 1))}
          aria-label="Día siguiente"
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {blockCount === 0
            ? "No tienes bloqueos este día"
            : blockCount === 1
              ? "1 bloqueo este día"
              : `${blockCount} bloqueos este día`}
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

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : timeline.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium text-foreground">No hay turnos este día</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Disfrutá el descanso, o revisá otro día.
          </p>
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
                onCancel={(reason) => handleCancel(item.id, reason)}
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
        size="icon-lg"
        className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
      <DialogContent>
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
                Día libre, de una
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
                className="h-10 flex-1"
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

        <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
          <span className="text-sm font-medium">{appointment.clients?.name ?? "Cliente"}</span>
          {appointment.clients?.phone && (
            <a
              href={`tel:${appointment.clients.phone}`}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <Phone className="size-3.5" />
              {appointment.clients.phone}
            </a>
          )}
        </div>

        {isPending && (
          <div className="flex flex-col gap-2">
            <Button
              onClick={onComplete}
              disabled={isMutating}
              className="h-11 w-full text-base"
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
                No asistió
              </Button>
              <Button
                variant="ghost"
                onClick={() => onCancel("cancelled")}
                disabled={isMutating}
                className="h-11 flex-1 text-destructive hover:bg-destructive/10"
              >
                Cancelar
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
      <DialogContent>
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

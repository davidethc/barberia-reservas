"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  getAppointmentsForDate,
  completeAppointment,
  cancelAppointment,
  type AgendaAppointment,
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
import { formatDate, formatPrice, formatTime, cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Phone } from "lucide-react";

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

export function AgendaView({
  initialDate,
  initialAppointments,
}: {
  initialDate: string;
  initialAppointments: AgendaAppointment[];
}) {
  const [date, setDate] = useState(initialDate);
  const [appointments, setAppointments] = useState(initialAppointments);
  const [isLoading, startLoading] = useTransition();
  const [isMutating, startMutating] = useTransition();
  const [completingId, setCompletingId] = useState<string | null>(null);

  function loadDate(nextDate: string) {
    setDate(nextDate);
    startLoading(async () => {
      const result = await getAppointmentsForDate(nextDate);
      if (result.success) {
        setAppointments(result.data);
      } else {
        toast.error(result.error);
        setAppointments([]);
      }
    });
  }

  function handleCancel(id: string, reason: "cancelled" | "no_show") {
    startMutating(async () => {
      const result = await cancelAppointment({ appointmentId: id, reason });
      if (result.success) {
        toast.success(reason === "cancelled" ? "Turno cancelado" : "Marcado como no asistió");
        setAppointments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: reason } : a))
        );
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
        setAppointments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: "completed" } : a))
        );
        setCompletingId(null);
      } else {
        toast.error(result.error);
      }
    });
  }

  const completingAppointment = appointments.find((a) => a.id === completingId) ?? null;
  const isToday = date === todayStr();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between gap-2">
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

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium text-foreground">No hay turnos este día</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Disfruta el descanso, o revisa otro día.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((a) => (
            <AppointmentCard
              key={a.id}
              appointment={a}
              isMutating={isMutating}
              onComplete={() => setCompletingId(a.id)}
              onCancel={(reason) => handleCancel(a.id, reason)}
            />
          ))}
        </div>
      )}

      <CompleteDialog
        appointment={completingAppointment}
        isPending={isMutating}
        onOpenChange={(open) => !open && setCompletingId(null)}
        onConfirm={handleCompleted}
      />
    </div>
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

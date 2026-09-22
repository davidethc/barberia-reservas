"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ComponentProps,
  type CSSProperties,
} from "react";
import { toast } from "sonner";
import {
  getAgendaForDate,
  getAgendaRange,
  completeAppointment,
  cancelAppointment,
  createBlock,
  deleteBlock,
  type AgendaAppointment,
  type AgendaBlock,
  type AgendaDay,
  type AgendaRangeDay,
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
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { ConfirmDialog } from "@/components/staff/confirm-dialog";
import { FULL_DAY_START, FULL_DAY_END } from "@/lib/constants";
import {
  addDays,
  getDayOfWeek,
  formatDayNumber,
  formatWeekdayShort,
  shopToday as todayStr,
} from "@/lib/shop-date";
import { addMinutesToTime, formatDate, formatMoney, formatPrice, formatTime, cn } from "@/lib/utils";
import { Ban, CalendarOff, Check, ChevronLeft, ChevronRight, Gift, Phone, Trash2 } from "lucide-react";

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

const VIEWS = ["dia", "semana", "mes"] as const;
type ViewMode = (typeof VIEWS)[number];

const VIEW_LABEL: Record<ViewMode, string> = {
  dia: "Día",
  semana: "Semana",
  mes: "Mes",
};

function monthStartOf(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

/** The first Sunday on or before the month, plus the 42 cells a grid can show. */
function monthGridRange(anchor: string): { from: string; to: string } {
  const from = addDays(anchor, -getDayOfWeek(anchor));
  return { from, to: addDays(from, 41) };
}

function mapDays(days: AgendaRangeDay[]): Record<string, AgendaRangeDay> {
  return Object.fromEntries(days.map((day) => [day.date, day]));
}

function dateFromKey(key: string): Date {
  return new Date(key + "T12:00:00");
}

function keyFromDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

type DayCounts = {
  total: number;
  pendingCount: number;
  closed: number;
  hasBlocks: boolean;
  allBlocked: boolean;
  next: AgendaAppointment | null;
};

function countDay(day?: AgendaRangeDay): DayCounts {
  const appointments = day?.appointments ?? [];
  const blocks = day?.blocks ?? [];
  // The range query orders by `start_time`, so the first pending is the earliest one.
  const pending = appointments.filter((a) => a.status === "pending");
  return {
    total: appointments.length,
    pendingCount: pending.length,
    closed: appointments.length - pending.length,
    hasBlocks: blocks.length > 0,
    allBlocked: blocks.some(isFullDay),
    next: pending[0] ?? null,
  };
}

function weekSummaryLabel(total: number, pending: number): string {
  if (total === 0) return "Sin turnos esta semana";
  const turnos = total === 1 ? "1 turno" : `${total} turnos`;
  return pending > 0 ? `${turnos} · ${pending} por atender` : `${turnos} · todo cerrado`;
}

function dayPeekTitle(day: DayCounts): string {
  if (day.next) return `${formatTime(day.next.start_time)} · ${day.next.services?.name ?? "Servicio"}`;
  if (day.total > 0) return "Todo cerrado";
  if (day.allBlocked) return "Día bloqueado";
  if (day.hasBlocks) return "Con bloqueos";
  return "Sin turnos";
}

function dayPeekMeta(day: DayCounts): string {
  if (day.total > 0) return dayCountLabel(day.pendingCount, day.total);
  if (day.hasBlocks) return "Nadie puede reservar";
  return "Día libre";
}

export function AgendaView({
  initialDate,
  initialDay,
  initialView,
  initialWeekDays,
  initialMonthDays,
  barberId,
  commissionPct,
}: {
  initialDate: string;
  initialDay: AgendaDay;
  initialView: ViewMode;
  initialWeekDays: Record<string, AgendaRangeDay> | null;
  initialMonthDays: Record<string, AgendaRangeDay> | null;
  barberId: string;
  commissionPct: number;
}) {
  const [view, setView] = useState<ViewMode>(initialView);
  const [date, setDate] = useState(initialDate);
  const [day, setDay] = useState(initialDay);
  const [weekStart, setWeekStart] = useState(initialDate);
  const [weekDays, setWeekDays] = useState<Record<string, AgendaRangeDay> | null>(
    initialWeekDays
  );
  const [monthAnchor, setMonthAnchor] = useState(monthStartOf(initialDate));
  const [monthDays, setMonthDays] = useState<Record<string, AgendaRangeDay> | null>(
    initialMonthDays
  );

  const dateRef = useRef(date);
  const viewRef = useRef(view);
  const weekStartRef = useRef(weekStart);
  const monthAnchorRef = useRef(monthAnchor);

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
        setDay({ appointments: [], blocks: [], summary: { turnos: 0, cobrado: 0, comision: 0, teQueda: 0 }, loyalty: {} });
      }
    });
  }

  function loadWeek(start: string) {
    setWeekStart(start);
    weekStartRef.current = start;
    setWeekDays(null);
    startLoading(async () => {
      const result = await getAgendaRange({ from: start, to: addDays(start, 6) });
      if (result.success) {
        setWeekDays(mapDays(result.data.days));
      } else {
        toast.error(result.error);
        setWeekDays({});
      }
    });
  }

  function loadMonth(anchor: string) {
    setMonthAnchor(anchor);
    monthAnchorRef.current = anchor;
    setMonthDays(null);
    const { from, to } = monthGridRange(anchor);
    startLoading(async () => {
      const result = await getAgendaRange({ from, to });
      if (result.success) {
        setMonthDays(mapDays(result.data.days));
      } else {
        toast.error(result.error);
        setMonthDays({});
      }
    });
  }

  // Same fetch as loadDate, but without the skeleton flash — used when a realtime
  // event says the day on screen changed instead of when the barber navigates.
  const refreshQuietly = useCallback((forDate: string) => {
    getAgendaForDate(forDate).then((result) => {
      if (result.success && dateRef.current === forDate) {
        setDay(result.data);
      }
    });
  }, []);

  const refreshWeekQuietly = useCallback((start: string) => {
    getAgendaRange({ from: start, to: addDays(start, 6) }).then((result) => {
      if (result.success && weekStartRef.current === start) {
        setWeekDays(mapDays(result.data.days));
      }
    });
  }, []);

  const refreshMonthQuietly = useCallback((anchor: string) => {
    const { from, to } = monthGridRange(anchor);
    getAgendaRange({ from, to }).then((result) => {
      if (result.success && monthAnchorRef.current === anchor) {
        setMonthDays(mapDays(result.data.days));
      }
    });
  }, []);

  /** True when a date belongs to whatever period is on screen right now. */
  const isDateVisible = useCallback((forDate: string): boolean => {
    if (viewRef.current === "dia") return forDate === dateRef.current;
    if (viewRef.current === "semana") {
      const start = weekStartRef.current;
      return forDate >= start && forDate <= addDays(start, 6);
    }
    const { from, to } = monthGridRange(monthAnchorRef.current);
    return forDate >= from && forDate <= to;
  }, []);

  const refreshCurrentView = useCallback(() => {
    if (viewRef.current === "dia") refreshQuietly(dateRef.current);
    else if (viewRef.current === "semana") refreshWeekQuietly(weekStartRef.current);
    else refreshMonthQuietly(monthAnchorRef.current);
  }, [refreshQuietly, refreshWeekQuietly, refreshMonthQuietly]);

  function changeView(next: ViewMode) {
    if (next === view) return;
    setView(next);
    viewRef.current = next;
    if (next === "semana") {
      // Keep what is on screen until the fresh range arrives, like refreshQuietly.
      if (weekDays) refreshWeekQuietly(weekStartRef.current);
      else loadWeek(dateRef.current);
    } else if (next === "mes") {
      if (monthDays) refreshMonthQuietly(monthAnchorRef.current);
      else loadMonth(monthStartOf(dateRef.current));
    }
  }

  function openDay(nextDate: string) {
    setView("dia");
    viewRef.current = "dia";
    if (nextDate !== dateRef.current) loadDate(nextDate);
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
          if (!isDateVisible(row.date)) return;
          toast.info(`Nuevo turno reservado a las ${formatTime(row.start_time)}`);
          refreshCurrentView();
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
          if (isDateVisible(row.date)) refreshCurrentView();
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
        // date on the payload to check — just re-pull whatever is on screen.
        () => refreshCurrentView()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [barberId, isDateVisible, refreshCurrentView]);

  // The URL is the source of truth for the initial view and date (set by the server
  // from `searchParams`), and stays in step so a reload or a shared link lands back here.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("v", view);
    params.set("d", date);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }, [view, date]);

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
        setWeekDays(null);
        setMonthDays(null);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleCompleted(id: string, payment: CompletePayment) {
    startMutating(async () => {
      const result = await completeAppointment({ appointmentId: id, ...payment });
      if (result.success) {
        toast.success(payment.redeemReward ? "Corte gratis aplicado" : "Turno completado");
        setDay((prev) => {
          const done = prev.appointments.find((a) => a.id === id);
          const card = done ? prev.loyalty?.[done.client_id] : undefined;
          return {
            ...prev,
            appointments: prev.appointments.map((a) =>
              a.id === id ? { ...a, status: "completed", is_reward: payment.redeemReward === true } : a
            ),
            // The reward is spent: stop offering it on the client's other turns right away,
            // before the quiet refresh below brings the recomputed card.
            loyalty:
              payment.redeemReward && done && card
                ? { ...prev.loyalty, [done.client_id]: { ...card, progress: 0, eligible: false } }
                : prev.loyalty,
          };
        });
        setCompletingId(null);
        refreshQuietly(date);
        setWeekDays(null);
        setMonthDays(null);
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
        setWeekDays(null);
        setMonthDays(null);
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
        setWeekDays(null);
        setMonthDays(null);
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
  const summary = day.summary ?? { turnos: 0, cobrado: 0, comision: 0, teQueda: 0 };
  const nextPendingId = day.appointments.find((a) => a.status === "pending")?.id ?? null;
  const pct = commissionPct ?? 40;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <ViewTabs view={view} onChange={changeView} />

      {view === "dia" && (
        <>
          <div className="mb-3 flex items-center justify-between gap-2">
            <Button
              variant="outline"
              className="size-11 shrink-0"
              onClick={() => loadDate(addDays(date, -1))}
              aria-label="Día anterior"
            >
              <ChevronLeft className="size-5" />
            </Button>

            <div className="min-w-0 text-center">
              <h1 className="truncate font-heading text-lg font-semibold capitalize">
                {isToday ? "Hoy" : formatDate(date)}
              </h1>
              <p className="text-xs text-muted-foreground">
                {isToday ? formatDate(date) : dayCountLabel(pendingCount, day.appointments.length)}
              </p>
            </div>

            <Button
              variant="outline"
              className="size-11 shrink-0"
              onClick={() => loadDate(addDays(date, 1))}
              aria-label="Día siguiente"
            >
              <ChevronRight className="size-5" />
            </Button>
          </div>

          <div className="mb-6 space-y-3">
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

            {isToday && (
              <div className="grid grid-cols-2 gap-2">
                <TodayStat
                  label="Cobrado hoy"
                  value={formatMoney(summary.cobrado)}
                  meta={
                    summary.turnos === 1
                      ? "1 turno cobrado"
                      : `${summary.turnos} turnos cobrados`
                  }
                />
                <TodayStat
                  label="Mi parte"
                  value={formatMoney(summary.teQueda)}
                  meta={`${100 - pct}% del cobrado es tuyo`}
                />
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {blockCount === 1
                  ? "1 bloqueo"
                  : blockCount > 1
                    ? `${blockCount} bloqueos`
                    : isToday
                      ? "Sin bloqueos"
                      : "Sin bloqueos este día"}
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
                    isNext={item.appointment.id === nextPendingId}
                    rewardAvailable={day.loyalty?.[item.appointment.client_id]?.eligible === true}
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
        </>
      )}

      {view === "semana" && (
        <WeekView
          start={weekStart}
          days={weekDays}
          isLoading={isLoading}
          onPrev={() => loadWeek(addDays(weekStart, -7))}
          onNext={() => loadWeek(addDays(weekStart, 7))}
          onToday={() => loadWeek(todayStr())}
          onOpenDay={openDay}
        />
      )}

      {view === "mes" && (
        <MonthView
          anchor={monthAnchor}
          days={monthDays}
          selected={date}
          isLoading={isLoading}
          onOpenDay={openDay}
          onMonthChange={loadMonth}
        />
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
        pendingLabel="Guardando…"
        tone={closing?.reason === "cancelled" ? "destructive" : "default"}
        isPending={isMutating}
        onConfirm={() => closing && handleCancel(closing.id, closing.reason)}
        onOpenChange={(open) => {
          if (!open) setClosing(null);
        }}
      />

      <CompleteDialog
        appointment={completingAppointment}
        rewardAvailable={
          !!completingAppointment &&
          day.loyalty?.[completingAppointment.client_id]?.eligible === true
        }
        commissionPct={commissionPct}
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

function ViewTabs({ view, onChange }: { view: ViewMode; onChange: (view: ViewMode) => void }) {
  return (
    <div
      role="group"
      aria-label="Cambiar vista de la agenda"
      className="mb-4 flex items-center gap-1"
    >
      {VIEWS.map((option) => (
        <Button
          key={option}
          type="button"
          variant={view === option ? "default" : "ghost"}
          aria-pressed={view === option}
          onClick={() => onChange(option)}
          className={cn(
            "h-10 flex-1 rounded-full px-2 text-sm font-medium sm:flex-none sm:px-5",
            view === option
              ? "shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {VIEW_LABEL[option]}
        </Button>
      ))}
    </div>
  );
}

function PendingMark({ count, closed }: { count: number; closed: number }) {
  if (count > 0) {
    return (
      <span
        aria-hidden="true"
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-semibold tabular-nums text-accent-strong"
      >
        {count}
      </span>
    );
  }

  if (closed > 0) {
    return <Check aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />;
  }

  return null;
}

function WeekView({
  start,
  days,
  isLoading,
  onPrev,
  onNext,
  onToday,
  onOpenDay,
}: {
  start: string;
  days: Record<string, AgendaRangeDay> | null;
  isLoading: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onOpenDay: (date: string) => void;
}) {
  const today = todayStr();
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const end = dates[6]!;
  const isCurrentWeek = start === today;

  const totals = dates.reduce(
    (acc, date) => {
      const counts = countDay(days?.[date]);
      return { total: acc.total + counts.total, pending: acc.pending + counts.pendingCount };
    },
    { total: 0, pending: 0 }
  );

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button
          variant="outline"
          className="size-11 shrink-0"
          onClick={onPrev}
          aria-label="Semana anterior"
        >
          <ChevronLeft className="size-5" />
        </Button>

        <div className="min-w-0 text-center">
          <h1 className="truncate font-heading text-lg font-semibold">
            {isCurrentWeek ? "Próximos 7 días" : "Semana"}
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            {formatDate(start)} – {formatDate(end)}
          </p>
        </div>

        <Button
          variant="outline"
          className="size-11 shrink-0"
          onClick={onNext}
          aria-label="Semana siguiente"
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>

      {!isCurrentWeek && (
        <Button variant="secondary" className="mb-3 h-11 w-full" onClick={onToday}>
          Volver a hoy
        </Button>
      )}

      <p className="mb-4 text-sm text-muted-foreground">
        {weekSummaryLabel(totals.total, totals.pending)}
      </p>

      {isLoading || !days ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="space-y-2 sm:hidden">
            {dates.map((date) => (
              <WeekRow
                key={date}
                date={date}
                day={days[date]}
                isToday={date === today}
                onOpen={() => onOpenDay(date)}
              />
            ))}
          </div>

          <div className="hidden gap-2 sm:grid sm:grid-cols-7">
            {dates.map((date) => (
              <WeekTile
                key={date}
                date={date}
                day={days[date]}
                isToday={date === today}
                onOpen={() => onOpenDay(date)}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function WeekRow({
  date,
  day,
  isToday,
  onOpen,
}: {
  date: string;
  day?: AgendaRangeDay;
  isToday: boolean;
  onOpen: () => void;
}) {
  const counts = countDay(day);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        isToday
          ? "border-accent/50 bg-accent/5 hover:bg-accent/10"
          : "border-border bg-card hover:bg-muted/50"
      )}
    >
      <div className="w-11 shrink-0 text-center">
        <div
          className={cn(
            "text-[11px] uppercase tracking-wide text-muted-foreground",
            isToday && "text-accent-strong"
          )}
        >
          {isToday ? "Hoy" : formatWeekdayShort(date)}
        </div>
        <div
          className={cn(
            "font-heading text-xl font-bold tabular-nums",
            isToday && "text-accent-strong"
          )}
        >
          {formatDayNumber(date)}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{dayPeekTitle(counts)}</div>
        <div className="truncate text-xs text-muted-foreground">{dayPeekMeta(counts)}</div>
      </div>

      <PendingMark count={counts.pendingCount} closed={counts.closed} />
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function WeekTile({
  date,
  day,
  isToday,
  onOpen,
}: {
  date: string;
  day?: AgendaRangeDay;
  isToday: boolean;
  onOpen: () => void;
}) {
  const counts = countDay(day);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex min-h-32 flex-col gap-2 rounded-xl border p-3 text-left transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        isToday
          ? "border-accent/50 bg-accent/5 hover:bg-accent/10"
          : "border-border bg-card hover:bg-muted/50"
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            "text-[11px] uppercase tracking-wide text-muted-foreground",
            isToday && "text-accent-strong"
          )}
        >
          {isToday ? "Hoy" : formatWeekdayShort(date)}
        </span>
        <span
          className={cn(
            "font-heading text-lg font-bold tabular-nums",
            isToday && "text-accent-strong"
          )}
        >
          {formatDayNumber(date)}
        </span>
      </div>

      <div className="mt-auto">
        {counts.pendingCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent-strong">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
            {counts.pendingCount} por atender
          </span>
        ) : counts.total > 0 ? (
          <span className="text-xs text-muted-foreground">Todo cerrado</span>
        ) : counts.hasBlocks ? (
          <span className="text-xs text-muted-foreground">Bloqueado</span>
        ) : (
          <span className="text-xs text-muted-foreground">Libre</span>
        )}

        {counts.next && (
          <div className="mt-1 truncate text-xs text-muted-foreground">
            {formatTime(counts.next.start_time)} · {counts.next.services?.name ?? "Servicio"}
          </div>
        )}
      </div>
    </button>
  );
}

function MonthView({
  anchor,
  days,
  selected,
  isLoading,
  onOpenDay,
  onMonthChange,
}: {
  anchor: string;
  days: Record<string, AgendaRangeDay> | null;
  selected: string;
  isLoading: boolean;
  onOpenDay: (date: string) => void;
  onMonthChange: (anchor: string) => void;
}) {
  const currentMonth = monthStartOf(todayStr());
  const year = Number(anchor.slice(0, 4));

  return (
    <>
      {anchor !== currentMonth && (
        <Button
          variant="secondary"
          className="mb-3 h-11 w-full"
          disabled={isLoading}
          onClick={() => onMonthChange(currentMonth)}
        >
          Ir al mes actual
        </Button>
      )}

      {isLoading || !days ? (
        <div className="grid place-items-center py-8">
          <Skeleton className="h-80 w-full max-w-sm rounded-xl" />
        </div>
      ) : (
        <div className="mx-auto max-w-sm">
          <Calendar
            mode="single"
            month={dateFromKey(anchor)}
            selected={dateFromKey(selected)}
            onSelect={(picked) => picked && onOpenDay(keyFromDate(picked))}
            onMonthChange={(month) => onMonthChange(monthStartOf(keyFromDate(month)))}
            captionLayout="dropdown"
            startMonth={new Date(year - 2, 0)}
            endMonth={new Date(year + 2, 11)}
            style={{ "--cell-size": "clamp(2.25rem, 11vw, 3.25rem)" } as CSSProperties}
            className="w-full"
            components={{
              DayButton: (props) => <MonthDayButton {...props} days={days} />,
            }}
          />

          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
              Por atender
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-muted-foreground/40" />
              Todo cerrado
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-0.5 w-3 rounded-full bg-muted-foreground/40" />
              Bloqueado
            </span>
          </div>
        </div>
      )}
    </>
  );
}

function MonthDayButton({
  days,
  children,
  ...props
}: ComponentProps<typeof CalendarDayButton> & {
  days: Record<string, AgendaRangeDay>;
}) {
  const counts = countDay(days[keyFromDate(props.day.date)]);
  const mark =
    counts.pendingCount > 0
      ? "pending"
      : counts.total > 0
        ? "closed"
        : counts.hasBlocks
          ? "blocked"
          : null;

  const title =
    counts.pendingCount > 0
      ? `${counts.pendingCount} por atender`
      : counts.total > 0
        ? "Todo cerrado"
        : counts.hasBlocks
          ? "Bloqueado"
          : undefined;

  return (
    <CalendarDayButton {...props} title={title}>
      {children}
      {mark && (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute bottom-0.5 left-1/2 -translate-x-1/2 rounded-full",
            props.modifiers.outside && "opacity-40",
            mark === "pending" && "size-1.5 bg-accent",
            mark === "closed" && "size-1.5 bg-muted-foreground/40",
            mark === "blocked" && "h-0.5 w-3 bg-muted-foreground/40"
          )}
        />
      )}
    </CalendarDayButton>
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
            {isPending ? "Guardando…" : "Bloquear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Espina vertical de la jornada: punto (dorado para el próximo turno) + línea continua. */
function TimeRail({ dotClassName, className }: { dotClassName: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <span className={cn("size-2.5 shrink-0 rounded-full bg-border", dotClassName)} />
      <span className="w-px flex-1 bg-border" />
    </div>
  );
}

function AppointmentCard({
  appointment,
  isMutating,
  isNext,
  rewardAvailable,
  onComplete,
  onCancel,
}: {
  appointment: AgendaAppointment;
  isMutating: boolean;
  isNext: boolean;
  rewardAvailable: boolean;
  onComplete: () => void;
  onCancel: (reason: "cancelled" | "no_show") => void;
}) {
  const status = appointment.status;
  const isPending = status === "pending";

  if (!isPending) {
    const dot =
      status === "no_show" ? "bg-destructive/40" : status === "completed" ? "bg-border" : "bg-border";
    return (
      <div className="flex items-center gap-3">
        <TimeRail dotClassName={dot} />
        <div className="mb-3 flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl border border-border bg-card/50 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-base font-bold tabular-nums">
                {formatTime(appointment.start_time)}
              </span>
              <span className="truncate text-sm text-muted-foreground">
                {appointment.clients?.name ?? "Cliente"}
              </span>
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {appointment.services?.name ?? "Servicio"}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {status === "completed" && appointment.is_reward && (
              <span className="flex items-center gap-1 text-sm font-semibold text-accent">
                <Gift aria-hidden className="size-4" />
                Gratis
              </span>
            )}
            {status === "completed" && !appointment.is_reward && appointment.services?.price != null && (
              <span className="text-sm font-semibold tabular-nums">
                {formatPrice(appointment.services.price)}
              </span>
            )}
            <Badge variant={STATUS_VARIANT[status] ?? "outline"}>
              {STATUS_LABEL[status] ?? status}
            </Badge>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <TimeRail dotClassName={isNext ? "bg-accent" : "bg-foreground/25"} className="mt-2.5" />
      <Card className="mb-3 min-w-0 flex-1">
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-heading text-xl font-bold tabular-nums">
                {formatTime(appointment.start_time)}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {appointment.services?.name ?? "Servicio"}
                {appointment.services?.price != null && (
                  <> · {formatPrice(appointment.services.price)}</>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              {rewardAvailable && (
                <Badge variant="outline" className="gap-1 border-accent text-accent">
                  <Gift aria-hidden className="size-3" />
                  Corte gratis
                </Badge>
              )}
              <Badge variant={STATUS_VARIANT[appointment.status] ?? "outline"}>
                {STATUS_LABEL[appointment.status] ?? appointment.status}
              </Badge>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-lg bg-muted pl-3">
            <span className="min-w-0 truncate text-sm font-medium">
              {appointment.clients?.name ?? "Cliente"}
            </span>
            {appointment.clients?.phone && (
              <a
                href={`tel:${appointment.clients.phone}`}
                aria-label={`Llamar a ${appointment.clients.name ?? "el cliente"}`}
                className="flex h-11 shrink-0 items-center gap-1.5 rounded-r-lg px-3 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:z-10 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Phone className="size-4" />
                <span className="tabular-nums">{appointment.clients.phone}</span>
              </a>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Button
              onClick={onComplete}
              disabled={isMutating}
              variant="success"
              className="h-12 w-full text-base"
            >
              Completar
            </Button>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={() => onCancel("no_show")}
                disabled={isMutating}
                className="h-11 flex-1"
              >
                No vino
              </Button>
              <Button
                variant="default"
                onClick={() => onCancel("cancelled")}
                disabled={isMutating}
                className="h-11 flex-1"
              >
                Cancelar turno
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** What closing a turn records: a charge as before, or the client's free turn. */
type CompletePayment =
  | { redeemReward: true }
  | { redeemReward?: false; paymentMethod: "cash" | "transfer"; amount: number };

function CompleteDialog({
  appointment,
  rewardAvailable,
  commissionPct,
  isPending,
  onOpenChange,
  onConfirm,
}: {
  appointment: AgendaAppointment | null;
  rewardAvailable: boolean;
  commissionPct: number;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string, payment: CompletePayment) => void;
}) {
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer">("cash");
  const [amount, setAmount] = useState("");
  // Off by default: using up a client's reward is always the barber's explicit call.
  const [redeem, setRedeem] = useState(false);

  const servicePrice = appointment?.services?.price ?? 0;
  const defaultAmount = servicePrice;
  const amountValue = amount === "" ? defaultAmount : Number(amount);
  const isReward = rewardAvailable && redeem;
  const isValid = isReward || amountValue > 0;

  const pct = commissionPct ?? 40;
  // On a free turn the shop absorbs the reward: the commission is on the service price.
  const comision = round2(((isReward ? servicePrice : amountValue) * pct) / 100);
  const teQueda = round2(amountValue - comision);

  return (
    <Dialog
      open={!!appointment}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
          setPaymentMethod("cash");
          setAmount("");
          setRedeem(false);
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
          {rewardAvailable && (
            <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-accent/60 px-4 py-3">
              <span className="flex items-start gap-2.5">
                <Gift aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
                <span>
                  <span className="block text-sm font-medium">Aplicar corte gratis</span>
                  <span className="block text-sm text-muted-foreground">
                    Este cliente completó su tarjeta de sellos.
                  </span>
                </span>
              </span>
              <Switch checked={redeem} onCheckedChange={setRedeem} aria-label="Aplicar corte gratis" />
            </label>
          )}

          {isReward ? (
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Monto</span>
              <span className="tabular-nums font-bold">{formatMoney(0)}</span>
            </div>
          ) : (
            <>
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
                  name="amount"
                  type="number"
                  inputMode="decimal"
                  autoComplete="off"
                  min={0}
                  step="0.01"
                  className="h-11"
                  placeholder={String(defaultAmount)}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="rounded-xl border border-border bg-muted/60 px-4 py-3">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Comisión ({pct}%)</span>
              <span className="tabular-nums font-medium">{formatMoney(comision)}</span>
            </div>
            {isReward ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Sobre {formatMoney(servicePrice)}, el precio del servicio. El corte gratis lo
                absorbe el local.
              </p>
            ) : (
              <div className="mt-1 flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">Te queda ({100 - pct}%)</span>
                <span className="tabular-nums font-bold">{formatMoney(teQueda)}</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            className="h-11 w-full text-base"
            disabled={!isValid || isPending || !appointment}
            onClick={() =>
              appointment &&
              onConfirm(
                appointment.id,
                isReward ? { redeemReward: true } : { paymentMethod, amount: amountValue }
              )
            }
          >
            {isPending ? "Guardando…" : isReward ? "Confirmar corte gratis" : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TodayStat({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 whitespace-nowrap text-base font-bold tabular-nums text-accent-strong sm:text-lg">
        {value}
      </div>
      <div className="whitespace-nowrap text-xs text-muted-foreground">{meta}</div>
    </div>
  );
}

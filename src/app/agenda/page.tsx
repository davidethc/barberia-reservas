import { getAgendaForDate, getAgendaRange, type AgendaRangeDay } from "@/app/actions/agenda";
import { AgendaView } from "@/components/agenda/agenda-view";
import { StaffHeader } from "@/components/staff/staff-header";
import { getCurrentBarber, isCurrentUserAdmin } from "@/lib/staff";
import { addDays, getDayOfWeek, shopToday } from "@/lib/shop-date";
import { Card, CardContent } from "@/components/ui/card";
import { TriangleAlert } from "lucide-react";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type ViewMode = "dia" | "semana" | "mes";

function monthStartOf(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

/** The first Sunday on or before the month, plus the 42 cells a grid can show. */
function monthGridRange(anchor: string): { from: string; to: string } {
  const from = addDays(anchor, -getDayOfWeek(anchor));
  return { from, to: addDays(from, 41) };
}

async function loadRange(from: string, to: string): Promise<Record<string, AgendaRangeDay>> {
  const result = await getAgendaRange({ from, to });
  if (!result.success) return {};
  return Object.fromEntries(result.data.days.map((day) => [day.date, day]));
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string; d?: string }>;
}) {
  const query = await searchParams;
  const initialView: ViewMode =
    query.v === "semana" ? "semana" : query.v === "mes" ? "mes" : "dia";
  const requestedDate = query.d && DATE_KEY_PATTERN.test(query.d) ? query.d : null;
  const date = requestedDate ?? shopToday();

  const [barber, isAdmin] = await Promise.all([getCurrentBarber(), isCurrentUserAdmin()]);

  // A session with no barber row cannot have an agenda at all: say so instead of failing
  // with a generic "no se pudo cargar".
  if (!barber) {
    return (
      <div className="min-h-screen bg-background">
        <StaffHeader isAdmin={isAdmin} />
        <AgendaMessage
          title="Tu cuenta todavía no está vinculada"
          body="Tu usuario existe, pero no está asociado a ningún barbero, así que no hay agenda que mostrar. Pídele al administrador que vincule tu correo desde el panel de Barberos y vuelve a entrar."
        />
      </div>
    );
  }

  const [result, initialWeekDays, initialMonthDays] = await Promise.all([
    getAgendaForDate(date),
    initialView === "semana" ? loadRange(date, addDays(date, 6)) : null,
    initialView === "mes" ? loadRangeRelativeToMonth(date) : null,
  ]);

  return (
    <div className="min-h-screen bg-background">
      <StaffHeader isAdmin={isAdmin} />
      {result.success ? (
        <AgendaView
          initialDate={date}
          initialDay={result.data}
          initialView={initialView}
          initialWeekDays={initialWeekDays}
          initialMonthDays={initialMonthDays}
          barberId={barber.id}
          commissionPct={barber.commission_pct ?? 40}
        />
      ) : (
        <AgendaMessage
          title={result.error}
          body="Puede ser la conexión. Vuelve a cargar la página en unos segundos; si sigue igual, avísale al administrador."
        />
      )}
    </div>
  );
}

async function loadRangeRelativeToMonth(date: string): Promise<Record<string, AgendaRangeDay>> {
  const { from, to } = monthGridRange(monthStartOf(date));
  return loadRange(from, to);
}

function AgendaMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
          <TriangleAlert className="size-6 text-destructive" />
          <p className="text-base font-semibold text-foreground">{title}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
        </CardContent>
      </Card>
    </div>
  );
}

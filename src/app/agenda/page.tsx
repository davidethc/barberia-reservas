import { getAgendaForDate } from "@/app/actions/agenda";
import { AgendaView } from "@/components/agenda/agenda-view";
import { StaffHeader } from "@/components/staff/staff-header";
import { isCurrentUserAdmin } from "@/lib/staff";

function todayStr(): string {
  return new Date().toISOString().split("T")[0]!;
}

export default async function AgendaPage() {
  const date = todayStr();
  const [result, isAdmin] = await Promise.all([getAgendaForDate(date), isCurrentUserAdmin()]);

  return (
    <div className="min-h-screen bg-background">
      <StaffHeader title="Agenda" isAdmin={isAdmin} />
      {result.success ? (
        <AgendaView initialDate={date} initialDay={result.data} />
      ) : (
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="text-sm font-medium text-foreground">{result.error}</p>
        </div>
      )}
    </div>
  );
}

import { getAppointmentsForDate } from "@/app/actions/agenda";
import { AgendaView } from "@/components/agenda/agenda-view";
import { StaffHeader } from "@/components/staff/staff-header";

function todayStr(): string {
  return new Date().toISOString().split("T")[0]!;
}

export default async function AgendaPage() {
  const date = todayStr();
  const result = await getAppointmentsForDate(date);

  return (
    <div className="min-h-screen bg-background">
      <StaffHeader title="Agenda" />
      {result.success ? (
        <AgendaView initialDate={date} initialAppointments={result.data} />
      ) : (
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="text-sm font-medium text-foreground">{result.error}</p>
        </div>
      )}
    </div>
  );
}

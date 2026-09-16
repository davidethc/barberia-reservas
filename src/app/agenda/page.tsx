import { getAgendaForDate } from "@/app/actions/agenda";
import { AgendaView } from "@/components/agenda/agenda-view";
import { StaffHeader } from "@/components/staff/staff-header";
import { getCurrentBarber, isCurrentUserAdmin } from "@/lib/staff";
import { Card, CardContent } from "@/components/ui/card";
import { TriangleAlert } from "lucide-react";

function todayStr(): string {
  return new Date().toISOString().split("T")[0]!;
}

export default async function AgendaPage() {
  const date = todayStr();
  const [barber, isAdmin] = await Promise.all([getCurrentBarber(), isCurrentUserAdmin()]);

  // A session with no barber row cannot have an agenda at all: say so instead of failing
  // with a generic "no se pudo cargar".
  if (!barber) {
    return (
      <div className="min-h-screen bg-background">
        <StaffHeader title="Agenda" isAdmin={isAdmin} />
        <AgendaMessage
          title="Tu cuenta todavía no está vinculada"
          body="Tu usuario existe, pero no está asociado a ningún barbero, así que no hay agenda que mostrar. Pídele al administrador que vincule tu correo desde el panel de Barberos y vuelve a entrar."
        />
      </div>
    );
  }

  const result = await getAgendaForDate(date);

  return (
    <div className="min-h-screen bg-background">
      <StaffHeader title="Agenda" isAdmin={isAdmin} />
      {result.success ? (
        <AgendaView initialDate={date} initialDay={result.data} />
      ) : (
        <AgendaMessage
          title={result.error}
          body="Puede ser la conexión. Vuelve a cargar la página en unos segundos; si sigue igual, avísale al administrador."
        />
      )}
    </div>
  );
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

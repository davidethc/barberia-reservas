"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  searchClients,
  updateClientNotes,
  getClientStats,
  type ClientsSnapshot,
} from "@/app/actions/admin";
import type { ClientListItem, ClientSort, ClientStats } from "@/lib/repositories/clients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Phone, Search, Star, StickyNote, Users, X } from "lucide-react";

const SORTS: { value: ClientSort; label: string }[] = [
  { value: "visits", label: "Más visitas" },
  { value: "recent", label: "Última visita" },
  { value: "name", label: "Nombre" },
];

/** From this many visits a client is a regular worth recognizing by name. */
const LOYAL_MIN_VISITS = 5;

const MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
] as const;

function formatLastVisit(value: string | null): string {
  if (!value) return "Sin visitas registradas";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin visitas registradas";

  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 30) return `Hace ${days} días`;

  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function visitsLabel(count: number | null): string {
  const visits = count ?? 0;
  return visits === 1 ? "1 visita" : `${visits} visitas`;
}

export function ClientsPanel({ initial }: { initial: ClientsSnapshot | null }) {
  const [term, setTerm] = useState("");
  const [sort, setSort] = useState<ClientSort>("visits");
  const [clients, setClients] = useState<ClientListItem[]>(initial?.items ?? []);
  const [hasMore, setHasMore] = useState(initial?.hasMore ?? false);
  const [stats, setStats] = useState<ClientStats | null>(initial?.stats ?? null);
  const [error, setError] = useState<string | null>(
    initial ? null : "No se pudieron cargar los clientes."
  );
  const [selected, setSelected] = useState<ClientListItem | null>(null);
  const [isSearching, startSearch] = useTransition();
  const [isLoadingMore, startLoadMore] = useTransition();

  // The first render already has server data for the default query; re-fetching it would just
  // make the tab flash on open.
  const skipFirstFetch = useRef(initial !== null);

  useEffect(() => {
    if (skipFirstFetch.current) {
      skipFirstFetch.current = false;
      return;
    }

    const timer = setTimeout(() => {
      startSearch(async () => {
        const result = await searchClients({ term, sort, offset: 0 });
        if (result.success) {
          setClients(result.data.items);
          setHasMore(result.data.hasMore);
          setError(null);
        } else {
          setError(result.error);
        }
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [term, sort]);

  function loadMore() {
    startLoadMore(async () => {
      const result = await searchClients({ term, sort, offset: clients.length });
      if (result.success) {
        setClients((prev) => [...prev, ...result.data.items]);
        setHasMore(result.data.hasMore);
      } else {
        toast.error(result.error);
      }
    });
  }

  function retry() {
    setError(null);
    startSearch(async () => {
      // Las tarjetas también se recargan: si la carga inicial falló, `stats` quedaba
      // en null para siempre porque solo se reintentaba la lista.
      const [result, statsResult] = await Promise.all([
        searchClients({ term, sort, offset: 0 }),
        getClientStats(),
      ]);

      if (statsResult.success) setStats(statsResult.data);

      if (result.success) {
        setClients(result.data.items);
        setHasMore(result.data.hasMore);
      } else {
        setError(result.error);
      }
    });
  }

  function handleNotesSaved(updated: ClientListItem) {
    setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setSelected(null);
  }

  const isEmpty = !isSearching && !error && clients.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-lg font-semibold">Clientes</h2>
        {stats && stats.total > 0 && (
          <p className="text-sm text-muted-foreground">
            {stats.total === 1 ? "1 cliente" : `${stats.total} clientes`} en la base
          </p>
        )}
      </div>

      {stats && stats.total > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <StatCard label="Clientes" value={stats.total} />
          <StatCard label="Repiten" value={stats.returning} />
          <StatCard label="Últimos 30 días" value={stats.recent} />
        </div>
      )}

      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar por nombre o teléfono"
            aria-label="Buscar clientes"
            className="h-11 pr-11 pl-9"
            autoComplete="off"
            maxLength={60}
          />
          {term && (
            <Button
              variant="ghost"
              className="absolute top-1/2 right-0 size-11 -translate-y-1/2"
              onClick={() => setTerm("")}
              aria-label="Limpiar búsqueda"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {SORTS.map((option) => (
            <Button
              key={option.value}
              variant={sort === option.value ? "default" : "outline"}
              className="h-11 shrink-0 px-3 sm:h-9"
              onClick={() => setSort(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center">
          <p className="text-sm font-medium text-destructive">{error}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Puede ser la conexión. Intenta de nuevo en unos segundos.
          </p>
          <Button variant="outline" className="mt-3 h-11" onClick={retry}>
            Reintentar
          </Button>
        </div>
      ) : isSearching ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : isEmpty ? (
        <EmptyState term={term} onClear={() => setTerm("")} />
      ) : (
        <>
          <div className="space-y-2">
            {clients.map((client) => (
              <ClientRow key={client.id} client={client} onOpen={() => setSelected(client)} />
            ))}
          </div>

          {hasMore && (
            <Button
              variant="outline"
              className="h-11 w-full"
              disabled={isLoadingMore}
              onClick={loadMore}
            >
              {isLoadingMore ? "Cargando..." : "Ver más clientes"}
            </Button>
          )}
        </>
      )}

      <ClientDetailDialog
        key={selected?.id ?? "client-detail"}
        client={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        onSaved={handleNotesSaved}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card size="sm">
      <CardContent>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function ClientRow({ client, onOpen }: { client: ClientListItem; onOpen: () => void }) {
  const visits = client.visit_count ?? 0;
  const isLoyal = visits >= LOYAL_MIN_VISITS;

  return (
    <div className="flex items-stretch gap-2 rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 rounded-l-xl px-3 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{client.name}</span>
          {isLoyal && (
            <Badge variant="outline" className="shrink-0 gap-1 border-accent text-accent">
              <Star className="size-3" />
              Fiel
            </Badge>
          )}
          {client.notes && (
            <StickyNote className="size-3.5 shrink-0 text-muted-foreground" aria-label="Con nota" />
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
          <span className="tabular-nums">{client.phone}</span>
          <span aria-hidden>·</span>
          <span className={cn("tabular-nums", visits > 0 && "text-foreground")}>
            {visitsLabel(client.visit_count)}
          </span>
          <span aria-hidden>·</span>
          <span>{formatLastVisit(client.last_visit)}</span>
        </div>
      </button>

      <a
        href={`tel:${client.phone}`}
        aria-label={`Llamar a ${client.name}`}
        className="flex w-14 shrink-0 items-center justify-center rounded-r-xl border-l border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:z-10 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Phone className="size-4" />
      </a>
    </div>
  );
}

function EmptyState({ term, onClear }: { term: string; onClear: () => void }) {
  if (term) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-4 py-12 text-center">
        <p className="text-sm font-medium text-foreground">
          Ningún cliente coincide con «{term}»
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Prueba con el número de teléfono o con parte del nombre.
        </p>
        <Button variant="outline" className="mt-4 h-11" onClick={onClear}>
          Limpiar búsqueda
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-4 py-12 text-center">
      <Users className="size-6 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium text-foreground">Todavía no hay clientes</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Cada reserva hecha desde la web crea un cliente con su teléfono y le suma una visita.
        En cuanto entre el primer turno vas a verlo aquí.
      </p>
    </div>
  );
}

function ClientDetailDialog({
  client,
  onOpenChange,
  onSaved,
}: {
  client: ClientListItem | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (client: ClientListItem) => void;
}) {
  const [notes, setNotes] = useState(client?.notes ?? "");
  const [isPending, startTransition] = useTransition();

  const isDirty = (client?.notes ?? "") !== notes;

  function handleSave() {
    if (!client) return;

    startTransition(async () => {
      const result = await updateClientNotes({ id: client.id, notes });
      if (result.success) {
        toast.success("Nota guardada");
        onSaved(result.data);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={!!client} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{client?.name ?? "Cliente"}</DialogTitle>
          <DialogDescription>
            {visitsLabel(client?.visit_count ?? 0)} · {formatLastVisit(client?.last_visit ?? null)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {client?.phone && (
            <a
              href={`tel:${client.phone}`}
              className="flex h-12 items-center gap-2 rounded-lg bg-muted px-3 text-sm font-medium transition-colors hover:bg-muted/70 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Phone className="size-4 text-muted-foreground" />
              <span className="tabular-nums">{client.phone}</span>
            </a>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="client-notes">Nota interna</Label>
            <Textarea
              id="client-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder="Cómo le gusta el corte, alergias, con qué barbero se atiende..."
            />
            <p className="text-xs text-muted-foreground">
              Solo la ve el equipo. El cliente nunca la lee.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            className="h-11 w-full text-base"
            disabled={!isDirty || isPending}
            onClick={handleSave}
          >
            {isPending ? "Guardando..." : "Guardar nota"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createService,
  updateService,
  toggleServiceActive,
  reorderServices,
} from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/staff/confirm-dialog";
import { formatPrice } from "@/lib/utils";
import { ArrowUp, ArrowDown, Plus, Pencil, Scissors } from "lucide-react";
import type { Database } from "@/types/database";

type Service = Database["public"]["Tables"]["services"]["Row"];

export function ServicesPanel({ initialServices }: { initialServices: Service[] }) {
  const [services, setServices] = useState(initialServices);
  const [editing, setEditing] = useState<Service | null>(null);
  const [creating, setCreating] = useState(false);
  const [deactivating, setDeactivating] = useState<Service | null>(null);
  const [isPending, startTransition] = useTransition();

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= services.length) return;

    const next = [...services];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setServices(next);

    startTransition(async () => {
      const result = await reorderServices({ orderedIds: next.map((s) => s.id) });
      if (!result.success) {
        toast.error(result.error);
        setServices(services);
      }
    });
  }

  function setActive(service: Service, isActive: boolean) {
    setServices((prev) =>
      prev.map((s) => (s.id === service.id ? { ...s, is_active: isActive } : s))
    );
    startTransition(async () => {
      const result = await toggleServiceActive({ id: service.id, isActive });
      if (result.success) {
        setDeactivating(null);
      } else {
        toast.error(result.error);
        setServices((prev) =>
          prev.map((s) => (s.id === service.id ? { ...s, is_active: service.is_active } : s))
        );
      }
    });
  }

  function handleToggleActive(service: Service) {
    // Hiding a service takes it off the booking site, so it asks first.
    if (service.is_active !== false) {
      setDeactivating(service);
      return;
    }
    setActive(service, true);
  }

  function handleSaved(saved: Service, isNew: boolean) {
    setServices((prev) =>
      isNew ? [...prev, saved] : prev.map((s) => (s.id === saved.id ? saved : s))
    );
    setEditing(null);
    setCreating(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Servicios</h2>
        <Button onClick={() => setCreating(true)} className="h-11 sm:h-8">
          <Plus className="size-4" />
          Nuevo servicio
        </Button>
      </div>

      {services.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-4 py-12 text-center">
          <Scissors className="size-6 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">Todavía no hay servicios</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Sin servicios cargados, nadie puede reservar desde la web. Crea el primero con su
            duración y su precio.
          </p>
          <Button className="mt-4 h-11" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Nuevo servicio
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {services.map((service, i) => (
              <ServiceRow
                key={service.id}
                service={service}
                isPending={isPending}
                isFirst={i === 0}
                isLast={i === services.length - 1}
                onMoveUp={() => move(i, -1)}
                onMoveDown={() => move(i, 1)}
                onEdit={() => setEditing(service)}
                onToggleActive={() => handleToggleActive(service)}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            El orden de esta lista es el orden en que el cliente ve los servicios al reservar.
          </p>
        </>
      )}

      <ConfirmDialog
        open={!!deactivating}
        title={`¿Ocultar ${deactivating?.name ?? "el servicio"}?`}
        description="Deja de aparecer en la web de reservas. Los turnos ya agendados con este servicio no se tocan. Puedes volver a activarlo cuando quieras."
        confirmLabel="Ocultar"
        pendingLabel="Ocultando..."
        isPending={isPending}
        onConfirm={() => deactivating && setActive(deactivating, false)}
        onOpenChange={(open) => {
          if (!open) setDeactivating(null);
        }}
      />

      <ServiceFormDialog
        key={editing?.id ?? "create"}
        service={editing}
        open={!!editing || creating}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setCreating(false);
          }
        }}
        onSaved={handleSaved}
        nextSortOrder={services.length}
      />
    </div>
  );
}

function ServiceRow({
  service,
  isPending,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onEdit,
  onToggleActive,
}: {
  service: Service;
  isPending: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{service.name}</span>
          {service.is_active === false && <Badge variant="secondary">Oculto</Badge>}
        </div>
        <div className="mt-1 text-sm text-muted-foreground tabular-nums">
          {service.duration_minutes} min
          <span aria-hidden> · </span>
          {formatPrice(service.price)}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <label className="flex h-11 items-center gap-2 text-sm text-muted-foreground sm:h-9">
          <Switch
            checked={service.is_active ?? true}
            onCheckedChange={onToggleActive}
            disabled={isPending}
            aria-label={`Visible: ${service.name}`}
          />
          Visible
        </label>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            className="size-11 sm:size-9"
            disabled={isFirst || isPending}
            onClick={onMoveUp}
            aria-label={`Subir ${service.name}`}
          >
            <ArrowUp className="size-4" />
          </Button>
          <Button
            variant="ghost"
            className="size-11 sm:size-9"
            disabled={isLast || isPending}
            onClick={onMoveDown}
            aria-label={`Bajar ${service.name}`}
          >
            <ArrowDown className="size-4" />
          </Button>
          <Button
            variant="ghost"
            className="size-11 sm:size-9"
            onClick={onEdit}
            aria-label={`Editar ${service.name}`}
          >
            <Pencil className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ServiceFormDialog({
  service,
  open,
  onOpenChange,
  onSaved,
  nextSortOrder,
}: {
  service: Service | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (service: Service, isNew: boolean) => void;
  nextSortOrder: number;
}) {
  const [name, setName] = useState(service?.name ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [duration, setDuration] = useState(String(service?.duration_minutes ?? 30));
  const [price, setPrice] = useState(String(service?.price ?? ""));
  const [isPending, startTransition] = useTransition();

  const isValid = name.trim().length >= 2 && Number(duration) > 0 && Number(price) >= 0;

  function handleSubmit() {
    if (!isValid) return;

    startTransition(async () => {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        durationMinutes: Number(duration),
        price: Number(price),
      };

      const result = service
        ? await updateService({ id: service.id, ...payload })
        : await createService({ ...payload, sortOrder: nextSortOrder });

      if (result.success) {
        toast.success(service ? "Servicio actualizado" : "Servicio creado");
        onSaved(
          {
            id: result.data.id,
            business_id: service?.business_id ?? "",
            name: payload.name,
            description: payload.description,
            duration_minutes: payload.durationMinutes,
            price: payload.price,
            is_active: service?.is_active ?? true,
            sort_order: service?.sort_order ?? nextSortOrder,
          },
          !service
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{service ? "Editar servicio" : "Nuevo servicio"}</DialogTitle>
          {!service && (
            <DialogDescription>
              Va a aparecer en la web de reservas apenas lo guardes.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="service-name">Nombre</Label>
            <Input
              id="service-name"
              className="h-11"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="service-description">Descripción</Label>
            <Textarea
              id="service-description"
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="service-duration">Duración (min)</Label>
              <Input
                id="service-duration"
                type="number"
                inputMode="numeric"
                min={1}
                className="h-11"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="service-price">Precio</Label>
              <Input
                id="service-price"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                className="h-11"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            className="h-11 w-full text-base"
            disabled={!isValid || isPending}
            onClick={handleSubmit}
          >
            {isPending ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

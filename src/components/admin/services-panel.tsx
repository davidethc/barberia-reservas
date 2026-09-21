"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { toast } from "sonner";
import {
  createService,
  updateService,
  toggleServiceActive,
  reorderServices,
  uploadServiceImage,
  removeServiceImage,
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
import { ArrowUp, ArrowDown, Plus, Pencil, Scissors, Upload, Trash2 } from "lucide-react";
import type { Database } from "@/types/database";

type Service = Database["public"]["Tables"]["services"]["Row"];

const SERVICE_EMOJIS = ["💈", "✂️", "🪒", "🧔", "💇", "🙍", "🧖", "🫧", "💆", "👑", "🕶️", "🧢", "⭐", "🦳", "💯", "🌿"];

const DEFAULT_SERVICE_ICON = "💈";

const SERVICE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

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

  function handleImageUrlChange(serviceId: string, imageUrl: string | null) {
    setServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, image_url: imageUrl } : s))
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-lg font-semibold">Servicios</h2>
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
        onImageUrlChange={handleImageUrlChange}
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
      <ServiceThumb service={service} className="size-11 rounded-lg" />
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
  onImageUrlChange,
  nextSortOrder,
}: {
  service: Service | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (service: Service, isNew: boolean) => void;
  onImageUrlChange: (serviceId: string, imageUrl: string | null) => void;
  nextSortOrder: number;
}) {
  const [name, setName] = useState(service?.name ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [duration, setDuration] = useState(String(service?.duration_minutes ?? 30));
  const [price, setPrice] = useState(String(service?.price ?? ""));
  const [icon, setIcon] = useState(service?.icon ?? DEFAULT_SERVICE_ICON);
  const [photoUrl, setPhotoUrl] = useState(service?.image_url ?? null);
  const [photoPending, setPhotoPending] = useState(false);
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
        icon,
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
            icon: payload.icon,
            image_url: service?.image_url ?? null,
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

  async function handlePhotoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !service) return;

    if (!/^image\/(png|jpeg|jpg|webp|avif)$/.test(file.type)) {
      toast.error("Formato no permitido. Usa PNG, JPG, WebP o AVIF.");
      return;
    }
    if (file.size > SERVICE_IMAGE_MAX_BYTES) {
      toast.error("La imagen pesa más de 2 MB.");
      return;
    }

    const fd = new FormData();
    fd.append("serviceId", service.id);
    fd.append("file", file);

    setPhotoPending(true);
    setPhotoUrl(URL.createObjectURL(file));
    const result = await uploadServiceImage(fd);
    setPhotoPending(false);

    if (result.success) {
      toast.success("Foto actualizada");
      setPhotoUrl(result.data.imageUrl);
      onImageUrlChange(service.id, result.data.imageUrl);
    } else {
      toast.error(result.error);
      setPhotoUrl(service.image_url ?? null);
    }
  }

  async function handleRemovePhoto() {
    if (!service) return;
    setPhotoPending(true);
    const result = await removeServiceImage({ serviceId: service.id });
    setPhotoPending(false);

    if (result.success) {
      toast.success("Foto quitada");
      setPhotoUrl(null);
      onImageUrlChange(service.id, null);
    } else {
      toast.error(result.error);
    }
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
          <div className="space-y-1.5">
            <Label>Emoji</Label>
            <p className="text-sm text-muted-foreground">
              Se muestra en la web mientras el servicio no tenga foto.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SERVICE_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  aria-pressed={icon === emoji}
                  aria-label={`Emoji ${emoji}`}
                  className={`flex size-11 items-center justify-center rounded-xl border text-xl transition-colors ${
                    icon === emoji
                      ? "border-accent bg-accent/10"
                      : "border-border bg-surface hover:border-accent/60"
                  }`}
                >
                  <span aria-hidden="true">{emoji}</span>
                </button>
              ))}
            </div>
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
          <div className="space-y-1.5">
            <Label>Foto</Label>
            {service ? (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
                <ServicePreview photoUrl={photoUrl} icon={icon} />
                <div className="flex flex-col items-start gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-accent/60">
                    <Upload className="size-4" aria-hidden="true" />
                    {photoPending ? "Subiendo..." : "Subir foto"}
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/avif"
                      className="sr-only"
                      disabled={photoPending}
                      onChange={handlePhotoSelected}
                    />
                  </label>
                  {photoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto px-2 py-1 text-sm text-destructive hover:text-destructive"
                      disabled={photoPending}
                      onClick={handleRemovePhoto}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      Quitar foto
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                Guardá el servicio primero y después podés subirle la foto desde esta misma
                ficha.
              </p>
            )}
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

function ServiceThumb({ service, className }: { service: Service; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (service.image_url && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- foto del servicio, host arbitrario (Storage o URL externa).
      <img
        src={service.image_url}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={`shrink-0 object-cover ring-1 ring-border ${className ?? ""}`}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-surface ring-1 ring-border ${
        className ?? ""
      }`}
      aria-hidden="true"
    >
      <span className="text-xl leading-none">{service.icon ?? DEFAULT_SERVICE_ICON}</span>
    </div>
  );
}

function ServicePreview({ photoUrl, icon }: { photoUrl: string | null; icon: string }) {
  const [failed, setFailed] = useState(false);

  if (photoUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- preview local del archivo o foto de Storage.
      <img
        src={photoUrl}
        alt=""
        onError={() => setFailed(true)}
        className="size-16 shrink-0 rounded-xl object-cover ring-1 ring-border"
      />
    );
  }

  return (
    <div
      className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-surface ring-1 ring-border"
      aria-hidden="true"
    >
      <span className="text-2xl leading-none">{icon}</span>
    </div>
  );
}

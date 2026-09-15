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
  DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatPrice } from "@/lib/utils";
import { ArrowUp, ArrowDown, Plus, Pencil } from "lucide-react";
import type { Database } from "@/types/database";

type Service = Database["public"]["Tables"]["services"]["Row"];

export function ServicesPanel({ initialServices }: { initialServices: Service[] }) {
  const [services, setServices] = useState(initialServices);
  const [editing, setEditing] = useState<Service | null>(null);
  const [creating, setCreating] = useState(false);
  const [isPending, startTransition] = useTransition();

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= services.length) return;

    const next = [...services];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setServices(next);

    startTransition(async () => {
      const result = await reorderServices({ orderedIds: next.map((s) => s.id) });
      if (!result.success) toast.error(result.error);
    });
  }

  function handleToggleActive(service: Service) {
    setServices((prev) =>
      prev.map((s) => (s.id === service.id ? { ...s, is_active: !s.is_active } : s))
    );
    startTransition(async () => {
      const result = await toggleServiceActive({ id: service.id, isActive: !service.is_active });
      if (!result.success) {
        toast.error(result.error);
        setServices((prev) =>
          prev.map((s) => (s.id === service.id ? { ...s, is_active: service.is_active } : s))
        );
      }
    });
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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Servicios</h2>
        <Button onClick={() => setCreating(true)} size="sm">
          <Plus className="size-4" />
          Nuevo servicio
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Orden</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Duración</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Activo</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((service, i) => (
              <TableRow key={service.id}>
                <TableCell>
                  <div className="flex gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={i === 0 || isPending}
                      onClick={() => move(i, -1)}
                      aria-label="Subir"
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={i === services.length - 1 || isPending}
                      onClick={() => move(i, 1)}
                      aria-label="Bajar"
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="font-medium">
                  {service.name}
                  {!service.is_active && (
                    <Badge variant="secondary" className="ml-2">
                      Inactivo
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{service.duration_minutes} min</TableCell>
                <TableCell>{formatPrice(service.price)}</TableCell>
                <TableCell>
                  <Switch
                    checked={service.is_active ?? true}
                    onCheckedChange={() => handleToggleActive(service)}
                    aria-label="Activo"
                  />
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditing(service)}>
                    <Pencil className="size-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {services.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Sin servicios todavía
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{service ? "Editar servicio" : "Nuevo servicio"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="service-name">Nombre</Label>
            <Input id="service-name" value={name} onChange={(e) => setName(e.target.value)} />
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
                min={1}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="service-price">Precio</Label>
              <Input
                id="service-price"
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button className="w-full" disabled={!isValid || isPending} onClick={handleSubmit}>
            {isPending ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createBarber,
  updateBarber,
  toggleBarberActive,
  linkBarberAccount,
  unlinkBarberAccount,
} from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Plus, Pencil, Link2, Link2Off, TriangleAlert } from "lucide-react";
import type { Database } from "@/types/database";

type Barber = Database["public"]["Tables"]["barbers"]["Row"];

export function BarbersPanel({ initialBarbers }: { initialBarbers: Barber[] }) {
  const [barbers, setBarbers] = useState(initialBarbers);
  const [editing, setEditing] = useState<Barber | null>(null);
  const [creating, setCreating] = useState(false);
  const [linking, setLinking] = useState<Barber | null>(null);
  const [isPending, startTransition] = useTransition();

  const unlinked = barbers.filter((b) => b.is_active !== false && !b.user_id);

  function handleToggleActive(barber: Barber) {
    setBarbers((prev) =>
      prev.map((b) => (b.id === barber.id ? { ...b, is_active: !b.is_active } : b))
    );
    startTransition(async () => {
      const result = await toggleBarberActive({ id: barber.id, isActive: !barber.is_active });
      if (!result.success) {
        toast.error(result.error);
        setBarbers((prev) =>
          prev.map((b) => (b.id === barber.id ? { ...b, is_active: barber.is_active } : b))
        );
      }
    });
  }

  function handleSaved(saved: Barber, isNew: boolean) {
    setBarbers((prev) => (isNew ? [...prev, saved] : prev.map((b) => (b.id === saved.id ? saved : b))));
    setEditing(null);
    setCreating(false);
  }

  function handleUnlink(barber: Barber) {
    startTransition(async () => {
      const result = await unlinkBarberAccount({ barberId: barber.id });
      if (result.success) {
        setBarbers((prev) => prev.map((b) => (b.id === barber.id ? { ...b, user_id: null } : b)));
        toast.success(`Cuenta desvinculada de ${barber.name}`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Barberos</h2>
        <Button onClick={() => setCreating(true)} size="sm">
          <Plus className="size-4" />
          Nuevo barbero
        </Button>
      </div>

      {unlinked.length > 0 && (
        <div className="flex gap-2.5 rounded-xl border border-border bg-muted/40 p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-muted-foreground">
            Sin cuenta vinculada: <span className="text-foreground">{unlinked.map((b) => b.name).join(", ")}</span>.
            Hasta que se vincule una cuenta no pueden entrar a su agenda.
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>PIN</TableHead>
              <TableHead>Comisión</TableHead>
              <TableHead>Cuenta</TableHead>
              <TableHead>Activo</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {barbers.map((barber) => (
              <TableRow key={barber.id}>
                <TableCell className="font-medium">
                  {barber.name}
                  {!barber.is_active && (
                    <Badge variant="secondary" className="ml-2">
                      Inactivo
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">{barber.pin}</TableCell>
                <TableCell>{barber.commission_pct}%</TableCell>
                <TableCell>
                  {barber.user_id ? (
                    <Badge variant="outline">Vinculada</Badge>
                  ) : (
                    <Badge variant="secondary">Sin cuenta</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={barber.is_active ?? true}
                    onCheckedChange={() => handleToggleActive(barber)}
                    disabled={isPending}
                    aria-label="Activo"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {barber.user_id ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={isPending}
                        onClick={() => handleUnlink(barber)}
                        aria-label={`Desvincular cuenta de ${barber.name}`}
                        title="Desvincular cuenta"
                      >
                        <Link2Off className="size-3.5" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setLinking(barber)}
                        aria-label={`Vincular cuenta a ${barber.name}`}
                        title="Vincular cuenta"
                      >
                        <Link2 className="size-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEditing(barber)}
                      aria-label={`Editar ${barber.name}`}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {barbers.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Sin barberos todavía
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        La cuenta de acceso se crea primero en Supabase (o la crea el barbero desde el registro).
        Después vinculala acá con el mismo correo para que pueda entrar a su agenda.
      </p>

      <LinkAccountDialog
        key={linking?.id ?? "link"}
        barber={linking}
        onOpenChange={(open) => {
          if (!open) setLinking(null);
        }}
        onLinked={(barberId, userId) => {
          setBarbers((prev) => prev.map((b) => (b.id === barberId ? { ...b, user_id: userId } : b)));
          setLinking(null);
        }}
      />

      <BarberFormDialog
        key={editing?.id ?? "create"}
        barber={editing}
        open={!!editing || creating}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setCreating(false);
          }
        }}
        onSaved={handleSaved}
      />
    </div>
  );
}

function LinkAccountDialog({
  barber,
  onOpenChange,
  onLinked,
}: {
  barber: Barber | null;
  onOpenChange: (open: boolean) => void;
  onLinked: (barberId: string, userId: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();

  const isValid = /^\S+@\S+\.\S+$/.test(email.trim());

  function handleSubmit() {
    if (!barber || !isValid) return;

    startTransition(async () => {
      const result = await linkBarberAccount({ barberId: barber.id, email: email.trim() });
      if (result.success) {
        toast.success(`Cuenta vinculada a ${barber.name}`);
        onLinked(result.data.id, result.data.userId);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={!!barber} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular cuenta{barber ? ` a ${barber.name}` : ""}</DialogTitle>
          <DialogDescription>
            Ingresá el correo de una cuenta que ya exista en Supabase. Si no existe, creala
            primero desde el panel de Supabase.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="link-email">Correo</Label>
          <Input
            id="link-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder="barbero@ejemplo.com"
          />
        </div>

        <DialogFooter>
          <Button className="w-full" disabled={!isValid || isPending} onClick={handleSubmit}>
            {isPending ? "Vinculando..." : "Vincular"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BarberFormDialog({
  barber,
  open,
  onOpenChange,
  onSaved,
}: {
  barber: Barber | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (barber: Barber, isNew: boolean) => void;
}) {
  const [name, setName] = useState(barber?.name ?? "");
  const [pin, setPin] = useState(barber?.pin ?? "");
  const [commissionPct, setCommissionPct] = useState(String(barber?.commission_pct ?? 40));
  const [photoUrl, setPhotoUrl] = useState(barber?.photo_url ?? "");
  const [isPending, startTransition] = useTransition();

  const isValid =
    name.trim().length >= 2 &&
    /^\d{4,6}$/.test(pin) &&
    Number(commissionPct) >= 0 &&
    Number(commissionPct) <= 100;

  function handleSubmit() {
    if (!isValid) return;

    startTransition(async () => {
      const payload = {
        name: name.trim(),
        pin,
        commissionPct: Number(commissionPct),
        photoUrl: photoUrl.trim() || null,
      };

      const result = barber
        ? await updateBarber({ id: barber.id, ...payload })
        : await createBarber(payload);

      if (result.success) {
        toast.success(barber ? "Barbero actualizado" : "Barbero creado");
        onSaved(
          {
            id: result.data.id,
            business_id: barber?.business_id ?? "",
            user_id: barber?.user_id ?? null,
            name: payload.name,
            photo_url: payload.photoUrl,
            pin: payload.pin,
            commission_pct: payload.commissionPct,
            role: barber?.role ?? "barber",
            is_active: barber?.is_active ?? true,
            created_at: barber?.created_at ?? null,
          },
          !barber
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
          <DialogTitle>{barber ? "Editar barbero" : "Nuevo barbero"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="barber-name">Nombre</Label>
            <Input id="barber-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="barber-pin">PIN (4-6 dígitos)</Label>
              <Input
                id="barber-pin"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                maxLength={6}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="barber-commission">Comisión (%)</Label>
              <Input
                id="barber-commission"
                type="number"
                min={0}
                max={100}
                value={commissionPct}
                onChange={(e) => setCommissionPct(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="barber-photo">URL de foto (opcional)</Label>
            <Input
              id="barber-photo"
              value={photoUrl ?? ""}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://..."
            />
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

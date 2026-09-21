"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createBarberWithAccount,
  updateBarber,
  toggleBarberActive,
  linkBarberAccount,
  unlinkBarberAccount,
  resetBarberPassword,
} from "@/app/actions/admin";
import { PASSWORD_MIN_LENGTH } from "@/lib/schemas/admin";
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
import { ConfirmDialog } from "@/components/staff/confirm-dialog";
import { KeyRound, Link2, Link2Off, Pencil, Plus, TriangleAlert } from "lucide-react";
import type { Database } from "@/types/database";

type Barber = Database["public"]["Tables"]["barbers"]["Row"];

/** An active barber with no login cannot open /agenda at all — that is the state to surface. */
export function isUnlinked(barber: Barber): boolean {
  return barber.is_active !== false && !barber.user_id;
}

export function BarbersPanel({
  barbers,
  onBarbersChange,
}: {
  barbers: Barber[];
  onBarbersChange: (updater: (prev: Barber[]) => Barber[]) => void;
}) {
  const [editing, setEditing] = useState<Barber | null>(null);
  const [creating, setCreating] = useState(false);
  const [linking, setLinking] = useState<Barber | null>(null);
  const [resetting, setResetting] = useState<Barber | null>(null);
  const [deactivating, setDeactivating] = useState<Barber | null>(null);
  const [isPending, startTransition] = useTransition();

  const unlinked = barbers.filter(isUnlinked);

  function setActive(barber: Barber, isActive: boolean) {
    onBarbersChange((prev) =>
      prev.map((b) => (b.id === barber.id ? { ...b, is_active: isActive } : b))
    );
    startTransition(async () => {
      const result = await toggleBarberActive({ id: barber.id, isActive });
      if (result.success) {
        setDeactivating(null);
        toast.success(isActive ? `${barber.name} está activo` : `${barber.name} quedó inactivo`);
      } else {
        toast.error(result.error);
        onBarbersChange((prev) =>
          prev.map((b) => (b.id === barber.id ? { ...b, is_active: barber.is_active } : b))
        );
      }
    });
  }

  function handleToggleActive(barber: Barber) {
    // Turning a barber off hides him from the booking site, so it gets a confirmation step.
    if (barber.is_active !== false) {
      setDeactivating(barber);
      return;
    }
    setActive(barber, true);
  }

  function handleSaved(saved: Barber, isNew: boolean) {
    onBarbersChange((prev) =>
      isNew ? [...prev, saved] : prev.map((b) => (b.id === saved.id ? saved : b))
    );
    setEditing(null);
    setCreating(false);
  }

  function handleUnlink(barber: Barber) {
    startTransition(async () => {
      const result = await unlinkBarberAccount({ barberId: barber.id });
      if (result.success) {
        onBarbersChange((prev) =>
          prev.map((b) => (b.id === barber.id ? { ...b, user_id: null } : b))
        );
        toast.success(`Cuenta desvinculada de ${barber.name}`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-lg font-semibold">Barberos</h2>
        <Button onClick={() => setCreating(true)} className="h-11 sm:h-8">
          <Plus className="size-4" />
          Nuevo barbero
        </Button>
      </div>

      {unlinked.length > 0 && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3">
          <div className="flex gap-2.5">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-destructive">
                {unlinked.length === 1
                  ? "1 barbero no puede entrar a su agenda"
                  : `${unlinked.length} barberos no pueden entrar a su agenda`}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Sin una cuenta vinculada, la agenda les muestra un error y no ven sus turnos.
                Vincula el correo de cada uno para desbloquearlos.
              </p>

              <div className="mt-3 space-y-2">
                {unlinked.map((barber) => (
                  <div
                    key={barber.id}
                    className="flex flex-col gap-2 rounded-lg bg-background p-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="truncate text-sm font-medium">{barber.name}</span>
                    <Button
                      className="h-11 w-full sm:h-9 sm:w-auto"
                      onClick={() => setLinking(barber)}
                    >
                      <Link2 className="size-4" />
                      Vincular cuenta
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {barbers.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-4 py-12 text-center">
          <p className="text-sm font-medium text-foreground">Todavía no hay barberos</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Crea el primero con «Nuevo barbero» y después vincúlale una cuenta para que pueda
            abrir su agenda.
          </p>
          <Button className="mt-4 h-11" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Nuevo barbero
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {barbers.map((barber) => (
            <BarberRow
              key={barber.id}
              barber={barber}
              isPending={isPending}
              onEdit={() => setEditing(barber)}
              onLink={() => setLinking(barber)}
              onUnlink={() => handleUnlink(barber)}
              onResetPassword={() => setResetting(barber)}
              onToggleActive={() => handleToggleActive(barber)}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Al crear un barbero se crea también su acceso, y puede entrar de inmediato. Vincular
        cuenta sirve para un barbero que ya tenía uno.
      </p>

      <ConfirmDialog
        open={!!deactivating}
        title={`¿Desactivar a ${deactivating?.name ?? ""}?`}
        description="Deja de aparecer en la web de reservas y nadie puede pedirle turno. Los turnos ya agendados siguen en su agenda. Puedes reactivarlo cuando quieras."
        confirmLabel="Desactivar"
        pendingLabel="Desactivando..."
        isPending={isPending}
        onConfirm={() => deactivating && setActive(deactivating, false)}
        onOpenChange={(open) => {
          if (!open) setDeactivating(null);
        }}
      />

      <LinkAccountDialog
        key={linking?.id ?? "link"}
        barber={linking}
        onOpenChange={(open) => {
          if (!open) setLinking(null);
        }}
        onLinked={(barberId, userId) => {
          onBarbersChange((prev) =>
            prev.map((b) => (b.id === barberId ? { ...b, user_id: userId } : b))
          );
          setLinking(null);
        }}
      />

      <ResetPasswordDialog
        key={resetting?.id ?? "reset"}
        barber={resetting}
        onOpenChange={(open) => {
          if (!open) setResetting(null);
        }}
        onDone={() => setResetting(null)}
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

function BarberRow({
  barber,
  isPending,
  onEdit,
  onLink,
  onUnlink,
  onResetPassword,
  onToggleActive,
}: {
  barber: Barber;
  isPending: boolean;
  onEdit: () => void;
  onLink: () => void;
  onUnlink: () => void;
  onResetPassword: () => void;
  onToggleActive: () => void;
}) {
  const missingAccount = isUnlinked(barber);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{barber.name}</span>
          {barber.is_active === false && <Badge variant="secondary">Inactivo</Badge>}
          {missingAccount && (
            <Badge variant="destructive" className="gap-1">
              <TriangleAlert className="size-3" />
              Sin cuenta
            </Badge>
          )}
          {barber.user_id && <Badge variant="outline">Cuenta vinculada</Badge>}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          <span className="tabular-nums">PIN {barber.pin}</span>
          <span aria-hidden> · </span>
          <span className="tabular-nums">{barber.commission_pct}% de comisión</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <label className="flex h-11 items-center gap-2 text-sm text-muted-foreground sm:h-9">
          <Switch
            checked={barber.is_active ?? true}
            onCheckedChange={onToggleActive}
            disabled={isPending}
            aria-label={`Activo: ${barber.name}`}
          />
          Activo
        </label>

        <div className="flex items-center gap-1">
          {barber.user_id ? (
            <>
              <Button
                variant="ghost"
                className="size-11 sm:size-9"
                disabled={isPending}
                onClick={onResetPassword}
                aria-label={`Restablecer contraseña de ${barber.name}`}
                title="Restablecer contraseña"
              >
                <KeyRound className="size-4" />
              </Button>
              <Button
                variant="ghost"
                className="size-11 sm:size-9"
                disabled={isPending}
                onClick={onUnlink}
                aria-label={`Desvincular cuenta de ${barber.name}`}
                title="Desvincular cuenta"
              >
                <Link2Off className="size-4" />
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              className="h-11 sm:h-9"
              onClick={onLink}
              aria-label={`Vincular cuenta a ${barber.name}`}
            >
              <Link2 className="size-4" />
              Vincular
            </Button>
          )}
          <Button
            variant="ghost"
            className="size-11 sm:size-9"
            onClick={onEdit}
            aria-label={`Editar ${barber.name}`}
          >
            <Pencil className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordDialog({
  barber,
  onOpenChange,
  onDone,
}: {
  barber: Barber | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  const isValid = password.length >= PASSWORD_MIN_LENGTH;

  function handleSubmit() {
    if (!barber || !isValid) return;

    startTransition(async () => {
      const result = await resetBarberPassword({ barberId: barber.id, password });
      if (result.success) {
        toast.success(`Contraseña actualizada para ${barber.name}`);
        onDone();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={!!barber} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Restablecer contraseña{barber ? ` de ${barber.name}` : ""}
          </DialogTitle>
          <DialogDescription>
            La anterior deja de servir apenas guardes. Dile la nueva y pídele que la cambie.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="reset-password">Nueva contraseña</Label>
          <Input
            id="reset-password"
            type="text"
            autoComplete="off"
            className="h-11"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres`}
          />
        </div>

        <DialogFooter>
          <Button
            className="h-11 w-full text-base"
            disabled={!isValid || isPending}
            onClick={handleSubmit}
          >
            {isPending ? "Guardando..." : "Guardar contraseña"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vincular cuenta{barber ? ` a ${barber.name}` : ""}</DialogTitle>
          <DialogDescription>
            Para un barbero que ya tiene cuenta. Si todavía no tiene, créalo con Nuevo
            barbero: ahí el acceso se genera junto con la ficha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="link-email">Correo</Label>
          <Input
            id="link-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            className="h-11"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder="barbero@ejemplo.com"
          />
        </div>

        <DialogFooter>
          <Button
            className="h-11 w-full text-base"
            disabled={!isValid || isPending}
            onClick={handleSubmit}
          >
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  const isNew = !barber;
  const accountIsValid =
    !isNew || (/^\S+@\S+\.\S+$/.test(email.trim()) && password.length >= PASSWORD_MIN_LENGTH);
  const isValid =
    name.trim().length >= 2 &&
    /^\d{4,6}$/.test(pin) &&
    Number(commissionPct) >= 0 &&
    Number(commissionPct) <= 100 &&
    accountIsValid;

  function handleSubmit() {
    if (!isValid) return;

    startTransition(async () => {
      const payload = {
        name: name.trim(),
        pin,
        commissionPct: Number(commissionPct),
        photoUrl: photoUrl.trim() || null,
      };

      const saved = (id: string, userId: string | null): Barber => ({
        id,
        business_id: barber?.business_id ?? "",
        user_id: userId,
        name: payload.name,
        photo_url: payload.photoUrl,
        pin: payload.pin,
        commission_pct: payload.commissionPct,
        role: barber?.role ?? "barber",
        is_active: barber?.is_active ?? true,
        created_at: barber?.created_at ?? null,
      });

      if (barber) {
        const result = await updateBarber({ id: barber.id, ...payload });
        if (!result.success) {
          toast.error(result.error);
          return;
        }

        toast.success("Barbero actualizado");
        onSaved(saved(result.data.id, barber.user_id), false);
        return;
      }

      const result = await createBarberWithAccount({
        ...payload,
        email: email.trim(),
        password,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Barbero creado con su acceso");
      onSaved(saved(result.data.id, result.data.userId), true);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{barber ? "Editar barbero" : "Nuevo barbero"}</DialogTitle>
          {isNew && (
            <DialogDescription>
              Se crea junto con su acceso. Entrégale el correo y la contraseña; podrá entrar
              de inmediato y aparecerá como reservable para los clientes.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="barber-name">Nombre</Label>
            <Input
              id="barber-name"
              className="h-11"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="barber-pin">PIN (4-6 dígitos)</Label>
              <Input
                id="barber-pin"
                inputMode="numeric"
                className="h-11"
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
                inputMode="numeric"
                min={0}
                max={100}
                className="h-11"
                value={commissionPct}
                onChange={(e) => setCommissionPct(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="barber-photo">URL de foto (opcional)</Label>
            <Input
              id="barber-photo"
              className="h-11"
              value={photoUrl ?? ""}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          {isNew && (
            <div className="space-y-4 rounded-xl border border-border p-4">
              <p className="text-sm font-medium text-foreground">Datos de acceso</p>
              <div className="space-y-1.5">
                <Label htmlFor="barber-email">Correo</Label>
                <Input
                  id="barber-email"
                  type="email"
                  autoComplete="off"
                  className="h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="barbero@correo.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="barber-password">Contraseña inicial</Label>
                <Input
                  id="barber-password"
                  type="text"
                  autoComplete="off"
                  className="h-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres`}
                />
                <p className="text-sm text-muted-foreground">
                  Se muestra en claro para que puedas dictársela. Dile que la cambie.
                </p>
              </div>
            </div>
          )}
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

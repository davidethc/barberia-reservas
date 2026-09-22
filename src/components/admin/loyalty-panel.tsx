"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateLoyaltySettings } from "@/app/actions/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  MAX_LOYALTY_CYCLE,
  MIN_LOYALTY_CYCLE,
  ordinalTurn,
  paidTurnsPerReward,
  type LoyaltySettings,
} from "@/lib/loyalty";

export function LoyaltyPanel({ initial }: { initial: LoyaltySettings }) {
  const uid = useId();
  const [saved, setSaved] = useState(initial);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [cycleText, setCycleText] = useState(String(initial.cycle));
  const [isPending, startTransition] = useTransition();

  const cycle = Number(cycleText);
  const cycleIsValid =
    /^\d+$/.test(cycleText) && cycle >= MIN_LOYALTY_CYCLE && cycle <= MAX_LOYALTY_CYCLE;
  const isDirty = enabled !== saved.enabled || cycleText !== String(saved.cycle);
  const cycleChanged = cycleIsValid && cycle !== saved.cycle;

  function handleSave() {
    if (!cycleIsValid) return;

    startTransition(async () => {
      const result = await updateLoyaltySettings({ enabled, cycle });
      if (result.success) {
        setSaved(result.data);
        setEnabled(result.data.enabled);
        setCycleText(String(result.data.cycle));
        toast.success(result.data.enabled ? "Programa de fidelidad activo" : "Programa de fidelidad guardado");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-lg font-semibold">Fidelidad</h2>

      <Card>
        <CardContent className="space-y-5">
          <label className="flex min-h-11 items-center justify-between gap-3 sm:min-h-9">
            <span>
              <span className="block text-sm font-medium">Programa activo</span>
              <span className="block text-sm text-muted-foreground">
                {enabled
                  ? "Los clientes ven su tarjeta de sellos al reservar."
                  : "Apagado: la web se ve exactamente como antes."}
              </span>
            </span>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              aria-label="Programa de fidelidad activo"
            />
          </label>

          <div className="space-y-1.5">
            <Label htmlFor={`${uid}-cycle`}>Un corte gratis cada</Label>
            <div className="flex items-center gap-2">
              <Input
                id={`${uid}-cycle`}
                type="number"
                inputMode="numeric"
                min={MIN_LOYALTY_CYCLE}
                max={MAX_LOYALTY_CYCLE}
                step={1}
                value={cycleText}
                onChange={(e) => setCycleText(e.target.value)}
                aria-invalid={!cycleIsValid}
                aria-describedby={`${uid}-cycle-help`}
                className="h-11 w-24 tabular-nums sm:h-9"
              />
              <span className="text-sm text-muted-foreground">cortes</span>
            </div>
            <p id={`${uid}-cycle-help`} className={cycleIsValid ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
              {cycleIsValid
                ? `El cliente paga ${paidTurnsPerReward(cycle)} y el ${ordinalTurn(cycle)} va por la casa.`
                : `Elige un número entre ${MIN_LOYALTY_CYCLE} y ${MAX_LOYALTY_CYCLE}.`}
            </p>
          </div>

          {cycleChanged && saved.enabled && (
            <p role="note" className="rounded-xl border border-border bg-muted/60 px-4 py-3 text-sm">
              Cambiar el número mueve la tarjeta de quienes ya van sumando sellos: bajarlo
              adelanta premios y subirlo los aleja.
            </p>
          )}

          <div className="flex justify-end">
            <Button
              variant={isDirty ? "default" : "outline"}
              disabled={!isDirty || !cycleIsValid || isPending}
              onClick={handleSave}
              className="h-11 sm:h-9"
            >
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-1.5 text-sm text-muted-foreground">
        <p>
          Cuenta cualquier servicio completado. El premio vale para cualquier servicio y lo
          aplica el barbero al cobrar, desde su agenda.
        </p>
        <p>
          En un corte gratis la comisión del barbero se paga igual, sobre el precio del
          servicio: el premio lo absorbe el local.
        </p>
      </div>
    </div>
  );
}

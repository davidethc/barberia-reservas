"use client";

import { useEffect, useState, useTransition } from "react";
import type { DateRange } from "react-day-picker";
import { getCommissionsReport, type CommissionRow } from "@/app/actions/admin";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatMoney, formatDate } from "@/lib/utils";

/**
 * The picker hands back local midnight; `toISOString()` would shift that to the previous
 * day west of UTC and report the wrong range.
 */
function toISODate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function lastWeekRange(): DateRange {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 6);
  return { from: start, to: today };
}

export function CommissionsPanel() {
  const [range, setRange] = useState<DateRange | undefined>(lastWeekRange());
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!range?.from || !range?.to) return;
    const from = toISODate(range.from);
    const to = toISODate(range.to);

    startTransition(async () => {
      const result = await getCommissionsReport({ from, to });
      if (result.success) {
        setRows(result.data);
        setError(null);
      } else {
        setRows([]);
        setError(result.error);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.from?.getTime(), range?.to?.getTime(), reloadKey]);

  const totals = rows.reduce(
    (acc, r) => ({
      servicios: acc.servicios + (r.total_servicios ?? 0),
      ingreso: acc.ingreso + Number(r.ingreso_total ?? 0),
      comision: acc.comision + Number(r.comision_total ?? 0),
    }),
    { servicios: 0, ingreso: 0, comision: 0 }
  );

  const needsRange = !range?.from || !range?.to;

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-lg font-semibold">Reporte de comisiones</h2>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Button
          variant="outline"
          className="h-11 shrink-0 px-3 sm:h-9"
          onClick={() => {
            const today = new Date();
            setRange({ from: today, to: today });
          }}
        >
          Hoy
        </Button>
        <Button
          variant="outline"
          className="h-11 shrink-0 px-3 sm:h-9"
          onClick={() => setRange(lastWeekRange())}
        >
          Últimos 7 días
        </Button>
        <Button
          variant="outline"
          className="h-11 shrink-0 px-3 sm:h-9"
          onClick={() => {
            const today = new Date();
            setRange({ from: new Date(today.getFullYear(), today.getMonth(), 1), to: today });
          }}
        >
          Este mes
        </Button>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <Card className="w-full max-w-full sm:w-fit">
          <CardContent className="overflow-x-auto">
            <Calendar
              mode="range"
              selected={range}
              onSelect={setRange}
              numberOfMonths={1}
              disabled={{ after: new Date() }}
            />
          </CardContent>
        </Card>
      </div>

      {/* Tres ceros antes de la explicación se leen como un error del reporte. */}
      {rows.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <SummaryCard label="Servicios" value={String(totals.servicios)} />
          <SummaryCard label="Ingresos" value={formatMoney(totals.ingreso)} />
          <SummaryCard label="Comisiones" value={formatMoney(totals.comision)} />
        </div>
      )}

      {needsRange ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-12 text-center">
          <p className="text-sm font-medium text-foreground">Elige un rango de fechas</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Toca el día de inicio y el de fin en el calendario, o usa un atajo de arriba.
          </p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-8 text-center">
          <p className="text-sm font-medium text-destructive">{error}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Puede ser la conexión. Intenta de nuevo en unos segundos.
          </p>
          <Button
            variant="outline"
            className="mt-3 h-11"
            onClick={() => setReloadKey((k) => k + 1)}
          >
            Reintentar
          </Button>
        </div>
      ) : isPending ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-12 text-center">
          <p className="text-sm font-medium text-foreground">
            No hay turnos cobrados en este rango
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Las comisiones aparecen cuando un barbero completa un turno y registra el pago.
            Prueba con otro período.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Barbero</TableHead>
                <TableHead className="text-right">Servicios</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
                <TableHead className="text-right">Comisión</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={`${row.barber_id}-${row.fecha}-${i}`}>
                  <TableCell>{row.fecha ? formatDate(row.fecha) : "—"}</TableCell>
                  <TableCell className="font-medium">{row.name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.total_servicios ?? 0}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(Number(row.ingreso_total ?? 0))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(Number(row.comision_total ?? 0))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card size="sm">
      <CardContent>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate text-base font-bold tabular-nums sm:text-lg">{value}</div>
      </CardContent>
    </Card>
  );
}

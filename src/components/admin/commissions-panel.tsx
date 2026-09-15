"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";
import { getCommissionsReport, type CommissionRow } from "@/app/actions/admin";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatPrice, formatDate } from "@/lib/utils";

function toISODate(date: Date): string {
  return date.toISOString().split("T")[0]!;
}

function todayRange(): DateRange {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 6);
  return { from: start, to: today };
}

export function CommissionsPanel() {
  const [range, setRange] = useState<DateRange | undefined>(todayRange());
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!range?.from || !range?.to) return;
    const from = toISODate(range.from);
    const to = toISODate(range.to);

    startTransition(async () => {
      const result = await getCommissionsReport({ from, to });
      if (result.success) {
        setRows(result.data);
      } else {
        toast.error(result.error);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.from?.getTime(), range?.to?.getTime()]);

  const totals = rows.reduce(
    (acc, r) => ({
      servicios: acc.servicios + (r.total_servicios ?? 0),
      ingreso: acc.ingreso + Number(r.ingreso_total ?? 0),
      comision: acc.comision + Number(r.comision_total ?? 0),
    }),
    { servicios: 0, ingreso: 0, comision: 0 }
  );

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Reporte de comisiones</h2>

      <div className="flex flex-wrap items-start gap-4">
        <Card className="w-fit">
          <CardContent>
            <Calendar
              mode="range"
              selected={range}
              onSelect={setRange}
              numberOfMonths={1}
              disabled={{ after: new Date() }}
            />
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setRange(todayRange())}>
            Últimos 7 días
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const today = new Date();
              const start = new Date(today.getFullYear(), today.getMonth(), 1);
              setRange({ from: start, to: today });
            }}
          >
            Este mes
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const today = new Date();
              setRange({ from: today, to: today });
            }}
          >
            Hoy
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Servicios" value={String(totals.servicios)} />
        <SummaryCard label="Ingresos" value={formatPrice(totals.ingreso)} />
        <SummaryCard label="Comisiones" value={formatPrice(totals.comision)} />
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Barbero</TableHead>
              <TableHead>Servicios</TableHead>
              <TableHead>Ingresos</TableHead>
              <TableHead>Comisión</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Sin datos en este rango
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, i) => (
                <TableRow key={`${row.barber_id}-${row.fecha}-${i}`}>
                  <TableCell>{row.fecha ? formatDate(row.fecha) : "—"}</TableCell>
                  <TableCell className="font-medium">{row.name ?? "—"}</TableCell>
                  <TableCell>{row.total_servicios ?? 0}</TableCell>
                  <TableCell>{formatPrice(Number(row.ingreso_total ?? 0))}</TableCell>
                  <TableCell>{formatPrice(Number(row.comision_total ?? 0))}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card size="sm">
      <CardContent>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

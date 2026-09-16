"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ServicesPanel } from "@/components/admin/services-panel";
import { BarbersPanel, isUnlinked } from "@/components/admin/barbers-panel";
import { ClientsPanel } from "@/components/admin/clients-panel";
import { HoursPanel } from "@/components/admin/hours-panel";
import { CommissionsPanel } from "@/components/admin/commissions-panel";
import type { ClientsSnapshot } from "@/app/actions/admin";
import type { Database } from "@/types/database";

type Service = Database["public"]["Tables"]["services"]["Row"];
type Barber = Database["public"]["Tables"]["barbers"]["Row"];
type BusinessHours = Database["public"]["Tables"]["business_hours"]["Row"];

export function AdminTabs({
  services,
  barbers: initialBarbers,
  businessHours,
  clients,
}: {
  services: Service[];
  barbers: Barber[];
  businessHours: BusinessHours[];
  clients: ClientsSnapshot | null;
}) {
  // Barbers live here so the tab badge keeps counting the same list the panel edits.
  const [barbers, setBarbers] = useState(initialBarbers);
  const unlinkedCount = barbers.filter(isUnlinked).length;

  return (
    <Tabs defaultValue="services" className="mx-auto max-w-4xl px-4 py-6">
      <div className="-mx-4 mb-4 overflow-x-auto px-4 pb-1">
        <TabsList className="w-max group-data-horizontal/tabs:h-11">
          <TabsTrigger value="services" className="px-3">
            Servicios
          </TabsTrigger>
          <TabsTrigger value="clients" className="px-3">
            Clientes
          </TabsTrigger>
          <TabsTrigger value="barbers" className="gap-1.5 px-3">
            Barberos
            {unlinkedCount > 0 && (
              <span
                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive/15 px-1.5 text-xs font-semibold text-destructive tabular-nums"
                aria-label={`${unlinkedCount} sin cuenta vinculada`}
              >
                {unlinkedCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="hours" className="px-3">
            Horarios
          </TabsTrigger>
          <TabsTrigger value="commissions" className="px-3">
            Comisiones
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="services">
        <ServicesPanel initialServices={services} />
      </TabsContent>
      <TabsContent value="clients">
        <ClientsPanel initial={clients} />
      </TabsContent>
      <TabsContent value="barbers">
        <BarbersPanel barbers={barbers} onBarbersChange={setBarbers} />
      </TabsContent>
      <TabsContent value="hours">
        <HoursPanel initialHours={businessHours} />
      </TabsContent>
      <TabsContent value="commissions">
        <CommissionsPanel />
      </TabsContent>
    </Tabs>
  );
}

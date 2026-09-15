"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ServicesPanel } from "@/components/admin/services-panel";
import { BarbersPanel } from "@/components/admin/barbers-panel";
import { HoursPanel } from "@/components/admin/hours-panel";
import { CommissionsPanel } from "@/components/admin/commissions-panel";
import type { Database } from "@/types/database";

type Service = Database["public"]["Tables"]["services"]["Row"];
type Barber = Database["public"]["Tables"]["barbers"]["Row"];
type BusinessHours = Database["public"]["Tables"]["business_hours"]["Row"];

export function AdminTabs({
  services,
  barbers,
  businessHours,
}: {
  services: Service[];
  barbers: Barber[];
  businessHours: BusinessHours[];
}) {
  return (
    <Tabs defaultValue="services" className="mx-auto max-w-4xl px-4 py-6">
      <TabsList className="mb-4">
        <TabsTrigger value="services">Servicios</TabsTrigger>
        <TabsTrigger value="barbers">Barberos</TabsTrigger>
        <TabsTrigger value="hours">Horarios</TabsTrigger>
        <TabsTrigger value="commissions">Comisiones</TabsTrigger>
      </TabsList>

      <TabsContent value="services">
        <ServicesPanel initialServices={services} />
      </TabsContent>
      <TabsContent value="barbers">
        <BarbersPanel initialBarbers={barbers} />
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

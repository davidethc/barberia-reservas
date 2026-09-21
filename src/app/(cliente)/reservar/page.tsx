import type { Metadata } from "next";
import { getBookingData } from "@/app/actions/booking";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { BRAND_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Reservar cita · ${BRAND_NAME}`,
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ReservarPage({ searchParams }: PageProps<"/reservar">) {
  const [{ services, barbers, business, openDays, dates }, params] = await Promise.all([
    getBookingData(),
    searchParams,
  ]);
  const servicio = first(params.servicio);
  const barbero = first(params.barbero);

  return (
    <BookingWizard
      // Remount on a new deep link so client-side navigation from another card re-seeds the selection.
      key={`${servicio ?? ""}|${barbero ?? ""}`}
      services={services}
      barbers={barbers}
      business={business}
      openDays={openDays}
      dates={dates}
      initialServiceId={servicio}
      initialBarberId={barbero}
    />
  );
}

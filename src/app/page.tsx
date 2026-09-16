import { getBookingData } from "@/app/actions/booking";
import { BookingWizard } from "@/components/booking/booking-wizard";

export default async function HomePage() {
  const { services, barbers, business, openDays, dates } = await getBookingData();

  return (
    <BookingWizard
      services={services}
      barbers={barbers}
      business={business}
      openDays={openDays}
      dates={dates}
    />
  );
}

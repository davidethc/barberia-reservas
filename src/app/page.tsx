import { getBookingData } from "@/app/actions/booking";
import { BookingWizard } from "@/components/booking/booking-wizard";

export default async function HomePage() {
  const { services, barbers, business } = await getBookingData();

  return <BookingWizard services={services} barbers={barbers} business={business} />;
}

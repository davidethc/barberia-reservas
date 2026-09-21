export type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  icon: string | null;
  image_url: string | null;
};

export type Barber = {
  id: string;
  name: string;
  photo_url: string | null;
};

export type Business = {
  name: string;
  phone: string | null;
  address: string | null;
};

/**
 * The booking as it is kept on the client after confirming. Flattened (not
 * references to Service/Barber) because it round-trips through localStorage,
 * so the turn survives a refresh without another request.
 */
export type ConfirmedBooking = {
  code: string;
  serviceName: string;
  price: number;
  durationMinutes: number;
  barberName: string;
  date: string;
  time: string;
  notes?: string;
};

export function isConfirmedBooking(value: unknown): value is ConfirmedBooking {
  if (typeof value !== "object" || value === null) return false;
  const b = value as Record<string, unknown>;
  return (
    typeof b.code === "string" &&
    typeof b.serviceName === "string" &&
    typeof b.price === "number" &&
    typeof b.durationMinutes === "number" &&
    typeof b.barberName === "string" &&
    typeof b.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(b.date) &&
    typeof b.time === "string" &&
    /^\d{2}:\d{2}$/.test(b.time)
  );
}

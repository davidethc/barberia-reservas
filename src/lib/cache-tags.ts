/**
 * Cache tag shared between the public booking data cache (src/app/actions/booking.ts)
 * and the admin actions that change it (src/app/actions/admin.ts). Kept in its own module
 * because a "use server" file can only export async functions — a plain constant exported
 * from one breaks the server-action bundling.
 */
export const BOOKING_DATA_TAG = "booking-data";

export type AppointmentStatus = "pending" | "completed" | "cancelled" | "no_show";

const VALID_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ["completed", "cancelled", "no_show"],
  completed: [],
  cancelled: [],
  no_show: [],
};

export function canTransition(
  from: AppointmentStatus,
  to: AppointmentStatus
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

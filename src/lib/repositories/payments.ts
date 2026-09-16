import { createClient } from "@/lib/supabase/server";

export const paymentRepo = {
  /**
   * Closing a turn and recording its payment is one transaction inside
   * `complete_appointment`: a half-applied completion used to leave a payment attached to a
   * pending turn that could never be completed again. The barber and the commission are
   * resolved in Postgres from the session — `authenticated` no longer holds INSERT on
   * `payments`, so there is no path that could write a commission of its own choosing.
   * The raised error is passed through untouched for the action layer to map to a message.
   */
  async completeAppointment(data: {
    appointmentId: string;
    amount: number;
    paymentMethod: "cash" | "transfer";
  }) {
    const supabase = await createClient();

    const { data: paymentId, error } = await supabase.rpc("complete_appointment", {
      p_appointment_id: data.appointmentId,
      p_payment_method: data.paymentMethod,
      p_amount: data.amount,
    });

    if (error) throw error;
    return paymentId;
  },

  async getDailySummary(date: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("barber_commissions")
      .select("*")
      .eq("fecha", date);

    if (error) throw error;
    return data;
  },
};

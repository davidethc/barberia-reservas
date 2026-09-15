import { createClient } from "@/lib/supabase/server";

export const paymentRepo = {
  async create(data: {
    appointmentId: string;
    barberId: string;
    amount: number;
    paymentMethod: "cash" | "transfer";
    commissionPct: number;
  }) {
    const supabase = await createClient();
    const commissionAmount = (data.amount * data.commissionPct) / 100;

    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        appointment_id: data.appointmentId,
        barber_id: data.barberId,
        amount: data.amount,
        payment_method: data.paymentMethod,
        commission_amount: commissionAmount,
      })
      .select()
      .single();

    if (error) throw error;
    return payment;
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

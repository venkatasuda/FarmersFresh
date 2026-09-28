"use server";

import { createClient } from "@/lib/supabase/server";

export async function createSupportTicket(
  subject: string,
  message: string,
  orderNumber?: string
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_support_ticket", {
    p_subject: subject,
    p_message: message,
    p_order_number: orderNumber || null,
  });
  if (error) return { ok: false, message: "Couldn't send just now. Try again." };
  const d = (data ?? {}) as { ok?: boolean; message?: string };
  return { ok: !!d.ok, message: d.message ?? (d.ok ? "Sent." : "Please try again.") };
}

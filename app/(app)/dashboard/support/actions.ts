"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sanitizeError } from "@/lib/guard";

export type Ticket = {
  id: string;
  subject: string;
  message: string;
  orderNumber: string | null;
  status: "open" | "resolved";
  staffReply: string | null;
  createdAt: string;
};

export async function getTickets(all = false): Promise<Ticket[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_support_tickets", { p_all: all });
  return ((data ?? []) as Record<string, unknown>[]).map((t) => ({
    id: String(t.id),
    subject: String(t.subject ?? ""),
    message: String(t.message ?? ""),
    orderNumber: (t.order_number as string | null) ?? null,
    status: (t.status as Ticket["status"]) ?? "open",
    staffReply: (t.staff_reply as string | null) ?? null,
    createdAt: String(t.created_at),
  }));
}

export async function resolveTicket(
  id: string,
  reply: string
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_support_ticket", {
    p_id: id,
    p_reply: reply || null,
  });
  if (error) return { ok: false, message: sanitizeError(error.message) };
  revalidatePath("/dashboard/support");
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sanitizeError } from "@/lib/guard";

export type ReturnRow = {
  id: string;
  orderNumber: string;
  reason: string;
  status: "requested" | "approved" | "rejected";
  refundPoints: number;
  staffNote: string | null;
  createdAt: string;
  hasAccount: boolean;
};

export async function getReturns(all = false): Promise<ReturnRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_returns", { p_all: all });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    orderNumber: String(r.order_number),
    reason: String(r.reason ?? ""),
    status: (r.status as ReturnRow["status"]) ?? "requested",
    refundPoints: Number(r.refund_points ?? 0),
    staffNote: (r.staff_note as string | null) ?? null,
    createdAt: String(r.created_at),
    hasAccount: !!r.user_id,
  }));
}

export async function approveReturn(
  id: string,
  refundPoints: number,
  note?: string
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_return", {
    p_id: id,
    p_refund_points: Number.isFinite(refundPoints) ? Math.max(0, refundPoints) : 0,
    p_note: note || null,
  });
  if (error) return { ok: false, message: sanitizeError(error.message) };
  revalidatePath("/dashboard/returns");
  return { ok: true };
}

export async function rejectReturn(
  id: string,
  note?: string
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_return", { p_id: id, p_note: note || null });
  if (error) return { ok: false, message: sanitizeError(error.message) };
  revalidatePath("/dashboard/returns");
  return { ok: true };
}

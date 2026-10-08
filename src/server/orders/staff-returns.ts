import "server-only";
import type { ReturnRow } from "@/lib/contracts/staff-returns";
import { isUuid, sanitizeError, toAmount } from "@/lib/guard";
import { createClient } from "@/server/supabase/server";
import { revalidatePath } from "next/cache";

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
  if (!isUuid(id) || typeof refundPoints !== "number" || (refundPoints !== 0 && toAmount(refundPoints) !== refundPoints)) return { ok: false, message: "Refund exceeds collected payment." };
  if (note !== undefined && (typeof note !== "string" || note.length > 500)) return { ok: false, message: "Keep the note within 500 characters." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_return", {
    p_id: id,
    p_refund_points: refundPoints,
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
  if (!isUuid(id)) return { ok: false, message: "Access denied." };
  if (note !== undefined && (typeof note !== "string" || note.length > 500)) return { ok: false, message: "Keep the note within 500 characters." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_return", { p_id: id, p_note: note || null });
  if (error) return { ok: false, message: sanitizeError(error.message) };
  revalidatePath("/dashboard/returns");
  return { ok: true };
}

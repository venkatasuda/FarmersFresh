"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sanitizeError } from "@/lib/guard";

export type ExpiringBatch = {
  id: string;
  productName: string;
  batchCode: string;
  remaining: number;
  expiryDate: string | null;
  daysLeft: number | null;
  value: number;
};

export async function getExpiring(days = 7): Promise<ExpiringBatch[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("expiring_batches", { p_days: days });
  const rows = (data ?? []) as Record<string, unknown>[];
  return rows.map((b) => ({
    id: String(b.id),
    productName: String(b.product_name ?? ""),
    batchCode: String(b.batch_code ?? ""),
    remaining: Number(b.remaining ?? 0),
    expiryDate: (b.expiry_date as string | null) ?? null,
    daysLeft: b.days_left === null || b.days_left === undefined ? null : Number(b.days_left),
    value: Number(b.value ?? 0),
  }));
}

export async function writeOffBatch(
  batchId: string,
  reason = "expiry",
  note = ""
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("write_off_batch", {
    p_batch: batchId,
    p_reason: reason,
    p_note: note.trim() || null,
  });
  if (error) return { ok: false, message: sanitizeError(error.message) };
  revalidatePath("/dashboard/expiry");
  revalidatePath("/dashboard/wastage");
  revalidatePath("/dashboard/stock");
  revalidatePath("/");
  return { ok: true };
}

import "server-only";
import type { ExpiringBatch } from "@/lib/contracts/staff-expiry";
import { sanitizeError } from "@/lib/guard";
import { createClient } from "@/server/supabase/server";
import { revalidatePath } from "next/cache";

export async function getExpiring(days = 7, location?: string): Promise<ExpiringBatch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("expiring_batches", { p_days: days, p_location: location ?? null });
  if (error) throw new Error("Expiry information is temporarily unavailable.");
  const rows = (data ?? []) as Record<string, unknown>[];
  return rows.map((b) => ({
    id: String(b.id),
    productId: String(b.product_id),
    productName: String(b.product_name ?? ""),
    batchCode: String(b.batch_code ?? ""),
    remaining: Number(b.remaining ?? 0),
    expiryDate: (b.expiry_date as string | null) ?? null,
    daysLeft: b.days_left === null || b.days_left === undefined ? null : Number(b.days_left),
    value: Number(b.value ?? 0),
    salePrice: Number(b.sale_price ?? 0),
    lastCost: b.last_cost === null || b.last_cost === undefined ? null : Number(b.last_cost),
    markedDown: Boolean(b.marked_down),
  }));
}

/** Clearance-price a short-dated product until its expiry date. */
export async function markDown(
  productId: string,
  price: number,
  endsOn: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_markdown", {
    p_product: productId,
    p_price: price,
    p_ends: endsOn,
    p_reason: "short_dated",
  });
  if (error) return { ok: false, message: sanitizeError(error.message) };
  revalidatePath("/dashboard/expiry");
  revalidatePath("/");
  return { ok: true };
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

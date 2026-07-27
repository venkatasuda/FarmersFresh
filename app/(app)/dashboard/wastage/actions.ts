"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sanitizeError } from "@/lib/guard";

export const WASTAGE_REASONS = [
  { value: "spoilage", label: "Spoilage" },
  { value: "expiry", label: "Expired" },
  { value: "damage", label: "Damaged" },
  { value: "theft", label: "Theft / loss" },
  { value: "count_adjustment", label: "Count adjustment" },
  { value: "other", label: "Other" },
] as const;

export type WastageRow = {
  id: string;
  productName: string;
  quantity: number;
  reason: string;
  value: number;
  note: string | null;
  createdAt: string;
};

export type WastageSummary = {
  totalValue: number;
  totalEvents: number;
  byReason: { reason: string; value: number; events: number }[];
  byProduct: { productName: string; quantity: number; value: number }[];
};

export async function getWastageList(days = 30): Promise<WastageRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_wastage", { p_days: days, p_limit: 100 });
  const rows = (data ?? []) as Record<string, unknown>[];
  return rows.map((w) => ({
    id: String(w.id),
    productName: String(w.product_name ?? ""),
    quantity: Number(w.quantity ?? 0),
    reason: String(w.reason ?? ""),
    value: Number(w.value ?? 0),
    note: (w.note as string | null) ?? null,
    createdAt: String(w.created_at ?? ""),
  }));
}

export async function getWastageSummary(days = 30): Promise<WastageSummary> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("wastage_summary", { p_days: days });
  const d = (data ?? {}) as Record<string, unknown>;
  return {
    totalValue: Number(d.total_value ?? 0),
    totalEvents: Number(d.total_events ?? 0),
    byReason: ((d.by_reason ?? []) as Record<string, unknown>[]).map((r) => ({
      reason: String(r.reason ?? ""),
      value: Number(r.value ?? 0),
      events: Number(r.events ?? 0),
    })),
    byProduct: ((d.by_product ?? []) as Record<string, unknown>[]).map((p) => ({
      productName: String(p.product_name ?? ""),
      quantity: Number(p.quantity ?? 0),
      value: Number(p.value ?? 0),
    })),
  };
}

export async function logWastage(input: {
  locationId: string;
  productId: string;
  quantity: number;
  reason: string;
  note: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    return { ok: false, message: "Enter a quantity greater than zero." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("log_wastage", {
    p_location: input.locationId,
    p_product: input.productId,
    p_qty: input.quantity,
    p_reason: input.reason,
    p_note: input.note.trim() || null,
  });
  if (error) return { ok: false, message: sanitizeError(error.message) };
  revalidatePath("/dashboard/wastage");
  revalidatePath("/dashboard/stock");
  revalidatePath("/dashboard");
  revalidatePath("/");
  return { ok: true };
}

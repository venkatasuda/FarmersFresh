"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sanitizeError } from "@/lib/guard";

export type Farm = {
  id: string;
  name: string;
  location: string | null;
  kind: string;
  contact: string | null;
};
export type Batch = {
  id: string;
  productName: string;
  farmName: string | null;
  batchCode: string;
  sourceDate: string | null;
  quantity: number | null;
  createdAt: string;
};
export type RecallRow = {
  orderNumber: string;
  contactName: string;
  contactPhone: string;
  placedAt: string;
  status: string;
  quantity: number;
};

type Res = { ok: boolean; message?: string };

export async function getFarms(): Promise<Farm[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_farms");
  return ((data ?? []) as Record<string, unknown>[]).map((f) => ({
    id: String(f.id),
    name: String(f.name ?? ""),
    location: (f.location as string | null) ?? null,
    kind: String(f.kind ?? "own"),
    contact: (f.contact as string | null) ?? null,
  }));
}

export async function addFarm(input: {
  name: string;
  location: string;
  kind: string;
  contact: string;
  notes: string;
}): Promise<Res> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_farm", {
    p_name: input.name,
    p_location: input.location,
    p_kind: input.kind,
    p_contact: input.contact,
    p_notes: input.notes,
  });
  if (error) return { ok: false, message: sanitizeError(error.message) };
  revalidatePath("/dashboard/traceability");
  return { ok: true };
}

export async function getBatches(): Promise<Batch[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_batches", { p_limit: 50 });
  return ((data ?? []) as Record<string, unknown>[]).map((b) => ({
    id: String(b.id),
    productName: String(b.product_name ?? ""),
    farmName: (b.farm_name as string | null) ?? null,
    batchCode: String(b.batch_code ?? ""),
    sourceDate: (b.source_date as string | null) ?? null,
    quantity: b.quantity == null ? null : Number(b.quantity),
    createdAt: String(b.created_at),
  }));
}

export async function addBatch(input: {
  productId: string;
  farmId: string;
  batchCode: string;
  sourceDate: string;
  quantity: string;
  notes: string;
}): Promise<Res> {
  const supabase = await createClient();
  const qty = Number.parseFloat(input.quantity);
  const { error } = await supabase.rpc("add_batch", {
    p_product: input.productId,
    p_farm: input.farmId || null,
    p_batch_code: input.batchCode,
    p_source_date: input.sourceDate || null,
    p_quantity: Number.isFinite(qty) ? qty : null,
    p_notes: input.notes,
  });
  if (error) return { ok: false, message: sanitizeError(error.message) };
  revalidatePath("/dashboard/traceability");
  return { ok: true };
}

export async function recallTrace(
  productId: string,
  from: string,
  to: string
): Promise<RecallRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("recall_trace", {
    p_product: productId,
    p_from: from || null,
    p_to: to || null,
  });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    orderNumber: String(r.order_number),
    contactName: String(r.contact_name ?? ""),
    contactPhone: String(r.contact_phone ?? ""),
    placedAt: String(r.placed_at),
    status: String(r.status ?? ""),
    quantity: Number(r.quantity ?? 0),
  }));
}

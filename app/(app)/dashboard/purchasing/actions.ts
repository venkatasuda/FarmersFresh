"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sanitizeError } from "@/lib/guard";

export type Supplier = {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
};

export type PoSummary = {
  id: string;
  poNumber: string;
  status: "draft" | "ordered" | "received" | "cancelled";
  supplier: string | null;
  notes: string | null;
  orderedAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  itemCount: number;
  totalCost: number;
};

export type PoItem = {
  id: string;
  productId: string;
  productName: string;
  qtyOrdered: number;
  unitCost: number;
  qtyReceived: number;
};

export type PoDetail = {
  id: string;
  poNumber: string;
  status: PoSummary["status"];
  supplier: string | null;
  notes: string | null;
  items: PoItem[];
};

export type ProcurementOverview = {
  openPos: number;
  suppliers: number;
  wastageValue30d: number;
};

type Result = { ok: true } | { ok: false; message: string };

export async function getSuppliers(includeInactive = false): Promise<Supplier[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_suppliers", {
    p_include_inactive: includeInactive,
  });
  const rows = (data ?? []) as Record<string, unknown>[];
  return rows.map((s) => ({
    id: String(s.id),
    name: String(s.name ?? ""),
    contactName: (s.contact_name as string | null) ?? null,
    phone: (s.phone as string | null) ?? null,
    email: (s.email as string | null) ?? null,
    address: (s.address as string | null) ?? null,
    notes: (s.notes as string | null) ?? null,
    isActive: Boolean(s.is_active),
  }));
}

export async function getPurchaseOrders(): Promise<PoSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_purchase_orders", {
    p_status: null,
    p_limit: 50,
  });
  const rows = (data ?? []) as Record<string, unknown>[];
  return rows.map((p) => ({
    id: String(p.id),
    poNumber: String(p.po_number ?? ""),
    status: (p.status as PoSummary["status"]) ?? "draft",
    supplier: (p.supplier as string | null) ?? null,
    notes: (p.notes as string | null) ?? null,
    orderedAt: (p.ordered_at as string | null) ?? null,
    receivedAt: (p.received_at as string | null) ?? null,
    createdAt: String(p.created_at ?? ""),
    itemCount: Number(p.item_count ?? 0),
    totalCost: Number(p.total_cost ?? 0),
  }));
}

export async function getOverview(): Promise<ProcurementOverview> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("procurement_overview");
  const d = (data ?? {}) as Record<string, unknown>;
  return {
    openPos: Number(d.open_pos ?? 0),
    suppliers: Number(d.suppliers ?? 0),
    wastageValue30d: Number(d.wastage_value_30d ?? 0),
  };
}

export async function getPurchaseOrder(poId: string): Promise<PoDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_purchase_order", { p_po: poId });
  if (!data) return null;
  const d = data as Record<string, unknown>;
  const items = ((d.items ?? []) as Record<string, unknown>[]).map((i) => ({
    id: String(i.id),
    productId: String(i.product_id),
    productName: String(i.product_name ?? ""),
    qtyOrdered: Number(i.qty_ordered ?? 0),
    unitCost: Number(i.unit_cost ?? 0),
    qtyReceived: Number(i.qty_received ?? 0),
  }));
  return {
    id: String(d.id),
    poNumber: String(d.po_number ?? ""),
    status: (d.status as PoSummary["status"]) ?? "draft",
    supplier: (d.supplier as string | null) ?? null,
    notes: (d.notes as string | null) ?? null,
    items,
  };
}

export async function saveSupplier(input: {
  id: string | null;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_supplier", {
    p_id: input.id,
    p_name: input.name,
    p_contact: input.contactName,
    p_phone: input.phone,
    p_email: input.email,
    p_address: input.address,
    p_notes: input.notes,
  });
  if (error) return { ok: false, message: sanitizeError(error.message) };
  revalidatePath("/dashboard/purchasing");
  return { ok: true };
}

export async function setSupplierActive(
  id: string,
  active: boolean
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_supplier_active", {
    p_id: id,
    p_active: active,
  });
  if (error) return { ok: false, message: sanitizeError(error.message) };
  revalidatePath("/dashboard/purchasing");
  return { ok: true };
}

/**
 * Create a purchase order and its items in one step, optionally marking it as
 * ordered. Keeps the client simple — it builds the item list locally and posts
 * once. The server re-prices nothing here; costs are what the buyer entered.
 */
export async function createPurchaseOrder(input: {
  locationId: string;
  supplierId: string | null;
  notes: string;
  items: { productId: string; qty: number; unitCost: number }[];
  markOrdered: boolean;
}): Promise<{ ok: true; poNumber: string } | { ok: false; message: string }> {
  if (input.items.length === 0) {
    return { ok: false, message: "Add at least one item." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_purchase_order", {
    p_location: input.locationId,
    p_supplier: input.supplierId,
    p_notes: input.notes,
  });
  if (error || !data) {
    return { ok: false, message: sanitizeError(error?.message ?? "Couldn't create the order.") };
  }
  const po = data as { id: string; po_number: string };

  for (const it of input.items) {
    const { error: itemErr } = await supabase.rpc("add_po_item", {
      p_po: po.id,
      p_product: it.productId,
      p_qty: it.qty,
      p_unit_cost: it.unitCost,
    });
    if (itemErr) {
      return { ok: false, message: sanitizeError(itemErr.message) };
    }
  }

  if (input.markOrdered) {
    const { error: ordErr } = await supabase.rpc("mark_po_ordered", { p_po: po.id });
    if (ordErr) return { ok: false, message: sanitizeError(ordErr.message) };
  }

  revalidatePath("/dashboard/purchasing");
  revalidatePath("/dashboard/stock");
  return { ok: true, poNumber: po.po_number };
}

export async function receivePurchaseOrder(
  poId: string,
  items: { itemId: string; qty: number }[]
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("receive_purchase_order", {
    p_po: poId,
    p_items: items.map((i) => ({ item_id: i.itemId, qty: i.qty })),
  });
  if (error) return { ok: false, message: sanitizeError(error.message) };
  revalidatePath("/dashboard/purchasing");
  revalidatePath("/dashboard/stock");
  revalidatePath("/dashboard");
  revalidatePath("/");
  return { ok: true };
}

export async function cancelPurchaseOrder(poId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_purchase_order", { p_po: poId });
  if (error) return { ok: false, message: sanitizeError(error.message) };
  revalidatePath("/dashboard/purchasing");
  return { ok: true };
}

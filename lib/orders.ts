/**
 * SERVER ONLY — imports the Supabase server client. See `lib/shop.ts`.
 * Client Components want `lib/types.ts` for the order shapes and labels.
 */
import { createClient } from "@/lib/supabase/server";
import { num } from "@/lib/format";
import type { OrderStatus, StaffOrder } from "@/lib/types";

type ItemRow = {
  id: string;
  product_name: string;
  unit: string;
  quantity: string | number;
  unit_price: string | number;
  line_total: string | number;
};

type OrderRow = {
  id: string;
  order_number: string;
  contact_name: string;
  contact_phone: string;
  address_line: string;
  city: string | null;
  pincode: string | null;
  landmark: string | null;
  delivery_slot: string | null;
  notes: string | null;
  status: OrderStatus;
  subtotal: string | number;
  delivery_fee: string | number;
  total: string | number;
  placed_at: string;
  order_items: ItemRow[] | null;
};

/**
 * Orders for the staff queue. RLS (`orders_read`) restricts this to the
 * caller's org and locations — there is no org filter here because there
 * doesn't need to be one.
 */
export async function getOrders(
  includeFinished = false
): Promise<StaffOrder[]> {
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select(
      `id, order_number, contact_name, contact_phone, address_line, city,
       pincode, landmark, delivery_slot, notes, status, subtotal,
       delivery_fee, total, placed_at,
       order_items ( id, product_name, unit, quantity, unit_price, line_total )`
    )
    .order("placed_at", { ascending: false })
    .limit(100);

  if (!includeFinished) {
    query = query.not("status", "in", '("delivered","cancelled")');
  }

  const { data, error } = await query;

  if (error) {
    console.error("getOrders failed:", error.message);
    return [];
  }

  return ((data ?? []) as OrderRow[]).map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    contactName: o.contact_name,
    contactPhone: o.contact_phone,
    addressLine: o.address_line,
    city: o.city,
    pincode: o.pincode,
    landmark: o.landmark,
    deliverySlot: o.delivery_slot,
    notes: o.notes,
    status: o.status,
    subtotal: num(o.subtotal),
    deliveryFee: num(o.delivery_fee),
    total: num(o.total),
    placedAt: o.placed_at,
    items: (o.order_items ?? []).map((i) => ({
      id: i.id,
      productName: i.product_name,
      unit: i.unit,
      quantity: num(i.quantity),
      unitPrice: num(i.unit_price),
      lineTotal: num(i.line_total),
    })),
  }));
}

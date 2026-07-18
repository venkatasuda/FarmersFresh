import { createClient } from "@/lib/supabase/server";

export type OrderStatus =
  | "placed"
  | "confirmed"
  | "packed"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type OrderItem = {
  id: string;
  productName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type StaffOrder = {
  id: string;
  orderNumber: string;
  contactName: string;
  contactPhone: string;
  addressLine: string;
  city: string | null;
  pincode: string | null;
  landmark: string | null;
  deliverySlot: string | null;
  notes: string | null;
  status: OrderStatus;
  subtotal: number;
  deliveryFee: number;
  total: number;
  placedAt: string;
  items: OrderItem[];
};

function num(v: number | string | null | undefined, fallback = 0): number {
  if (v === null || v === undefined) return fallback;
  const n = typeof v === "number" ? v : Number.parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

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

export const SLOT_LABELS: Record<string, string> = {
  today_evening: "Today, 4–8 pm",
  tomorrow_morning: "Tomorrow, 7–11 am",
  tomorrow_evening: "Tomorrow, 4–8 pm",
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  placed: "New",
  confirmed: "Confirmed",
  packed: "Packed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** The next step in the fulfilment chain, or null if there isn't one. */
export function nextStatus(status: OrderStatus): OrderStatus | null {
  const chain: OrderStatus[] = [
    "placed",
    "confirmed",
    "packed",
    "out_for_delivery",
    "delivered",
  ];
  const i = chain.indexOf(status);
  return i >= 0 && i < chain.length - 1 ? chain[i + 1] : null;
}

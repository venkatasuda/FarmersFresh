/**
 * SERVER ONLY — imports the Supabase server client. See `lib/shop.ts`.
 * Orders that are being fulfilled, for the rider screen.
 */
import { createClient } from "@/lib/supabase/server";
import { num } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";

export type Delivery = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  contactName: string;
  contactPhone: string;
  addressLine: string;
  city: string | null;
  pincode: string | null;
  landmark: string | null;
  total: number;
  deliverySlot: string | null;
  assignedTo: string | null;
  assignedName: string | null;
  placedAt: string;
};

/**
 * The delivery run: orders that are confirmed, packed, or out for delivery —
 * i.e. everything a rider might carry. RLS scopes this to the caller's org.
 */
export async function getDeliveries(): Promise<Delivery[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select(
      `id, order_number, status, contact_name, contact_phone, address_line,
       city, pincode, landmark, total, delivery_slot, assigned_to, placed_at,
       assignee:profiles!orders_assigned_to_fkey(full_name)`
    )
    .in("status", ["confirmed", "packed", "out_for_delivery"])
    .order("placed_at", { ascending: true });

  if (error) {
    console.error("getDeliveries failed:", error.message);
    return [];
  }

  type Row = {
    id: string;
    order_number: string;
    status: OrderStatus;
    contact_name: string;
    contact_phone: string;
    address_line: string;
    city: string | null;
    pincode: string | null;
    landmark: string | null;
    total: string | number;
    delivery_slot: string | null;
    assigned_to: string | null;
    placed_at: string;
    assignee: { full_name: string | null } | { full_name: string | null }[] | null;
  };

  return ((data ?? []) as Row[]).map((o) => {
    const a = Array.isArray(o.assignee) ? o.assignee[0] : o.assignee;
    return {
      id: o.id,
      orderNumber: o.order_number,
      status: o.status,
      contactName: o.contact_name,
      contactPhone: o.contact_phone,
      addressLine: o.address_line,
      city: o.city,
      pincode: o.pincode,
      landmark: o.landmark,
      total: num(o.total),
      deliverySlot: o.delivery_slot,
      assignedTo: o.assigned_to,
      assignedName: a?.full_name ?? null,
      placedAt: o.placed_at,
    };
  });
}

/** The signed-in user's own profile id, so the UI can tell "mine" from others'. */
export async function getMyProfileId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

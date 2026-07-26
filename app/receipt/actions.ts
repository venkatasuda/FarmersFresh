"use server";

import { createClient } from "@/lib/supabase/server";

export type ReceiptItem = {
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
};

export type Receipt = {
  orderNumber: string;
  placedAt: string;
  status: string;
  isPaid: boolean;
  paymentMethod: string;
  contactName: string;
  contactPhone: string;
  addressLine: string;
  city: string | null;
  pincode: string | null;
  subtotal: number;
  discount: number;
  couponCode: string | null;
  pointsRedeemed: number;
  deliveryFee: number;
  total: number;
  pointsEarned: number;
  pointsWillEarn: number;
  items: ReceiptItem[];
  store: {
    name: string;
    gstin: string | null;
    address: string | null;
    supportPhone: string | null;
  };
};

/**
 * Fetches an order receipt. The database authorises it — the logged-in owner,
 * or a correct order-number + phone pair. Returns null when not permitted, so
 * a stranger changing the number in the URL learns nothing.
 */
export async function getReceipt(
  orderNumber: string,
  phone?: string
): Promise<Receipt | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_order_receipt", {
    p_number: orderNumber,
    p_phone: phone || null,
  });
  if (!data) return null;

  const d = data as Record<string, unknown>;
  const items = Array.isArray(d.items) ? (d.items as Record<string, unknown>[]) : [];
  const store = (d.store ?? {}) as Record<string, unknown>;
  return {
    orderNumber: String(d.order_number ?? ""),
    placedAt: String(d.placed_at ?? ""),
    status: String(d.status ?? ""),
    isPaid: Boolean(d.is_paid),
    paymentMethod: String(d.payment_method ?? "cod"),
    contactName: String(d.contact_name ?? ""),
    contactPhone: String(d.contact_phone ?? ""),
    addressLine: String(d.address_line ?? ""),
    city: (d.city as string | null) ?? null,
    pincode: (d.pincode as string | null) ?? null,
    subtotal: Number(d.subtotal ?? 0),
    discount: Number(d.discount ?? 0),
    couponCode: (d.coupon_code as string | null) ?? null,
    pointsRedeemed: Number(d.points_redeemed ?? 0),
    deliveryFee: Number(d.delivery_fee ?? 0),
    total: Number(d.total ?? 0),
    pointsEarned: Number(d.points_earned ?? 0),
    pointsWillEarn: Number(d.points_will_earn ?? 0),
    items: items.map((i) => ({
      name: String(i.name ?? ""),
      quantity: Number(i.quantity ?? 0),
      unit: String(i.unit ?? ""),
      unit_price: Number(i.unit_price ?? 0),
      line_total: Number(i.line_total ?? 0),
    })),
    store: {
      name: (store.name as string) || "Farmers Fresh",
      gstin: (store.gstin as string | null) ?? null,
      address: (store.address as string | null) ?? null,
      supportPhone: (store.support_phone as string | null) ?? null,
    },
  };
}

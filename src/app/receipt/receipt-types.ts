// Shared receipt shape + mapper. Kept out of actions.ts because a "use server"
// module may only export async functions, and both the server page (owner path)
// and the guest phone-gate action need this mapping.

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
  // Item fields stay snake_case — receipt-view reads it.unit_price / it.line_total.
  items: { name: string; quantity: number; unit: string; unit_price: number; line_total: number }[];
  store: { name: string; gstin: string | null; address: string | null; supportPhone: string | null };
};

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
  return Number.isFinite(x) ? x : 0;
}

/** Map the snake_case get_order_receipt jsonb into the camelCase Receipt. */
export function mapReceipt(raw: unknown): Receipt {
  const d = (raw ?? {}) as Record<string, unknown>;
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
    city: (d.city as string) ?? null,
    pincode: (d.pincode as string) ?? null,
    subtotal: n(d.subtotal),
    discount: n(d.discount),
    couponCode: (d.coupon_code as string) ?? null,
    pointsRedeemed: n(d.points_redeemed),
    deliveryFee: n(d.delivery_fee),
    total: n(d.total),
    pointsEarned: n(d.points_earned),
    pointsWillEarn: n(d.points_will_earn),
    items: ((d.items as unknown[]) ?? []).map((i) => {
      const it = (i ?? {}) as Record<string, unknown>;
      return {
        name: String(it.name ?? ""),
        quantity: n(it.quantity),
        unit: String(it.unit ?? ""),
        unit_price: n(it.unit_price),
        line_total: n(it.line_total),
      };
    }),
    store: {
      name: String(store.name ?? "Farmers Fresh"),
      gstin: (store.gstin as string) ?? null,
      address: (store.address as string) ?? null,
      supportPhone: (store.support_phone as string) ?? null,
    },
  };
}

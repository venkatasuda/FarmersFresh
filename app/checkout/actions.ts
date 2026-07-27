"use server";

import { createClient } from "@/lib/supabase/server";
import { toQuantity } from "@/lib/guard";

export type PaymentMethod = "cod" | "upi" | "card";

export type PlaceOrderResult =
  | {
      ok: true;
      orderId: string;
      orderNumber: string;
      total: number;
      paymentMethod: PaymentMethod;
    }
  | { ok: false; message: string };

export type SubmittedLine = { productId: string; quantity: number };

export type SavedAddress = {
  id: string;
  label: string | null;
  contactName: string | null;
  contactPhone: string | null;
  addressLine: string;
  city: string | null;
  pincode: string | null;
  landmark: string | null;
  isDefault: boolean;
};

/** The logged-in customer's saved addresses for the checkout picker. */
export async function getMyAddresses(): Promise<SavedAddress[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("customer_addresses")
    .select("*")
    .order("is_default", { ascending: false });

  return (
    (data ?? []) as {
      id: string;
      label: string | null;
      contact_name: string | null;
      contact_phone: string | null;
      address_line: string;
      city: string | null;
      pincode: string | null;
      landmark: string | null;
      is_default: boolean;
    }[]
  ).map((a) => ({
    id: a.id,
    label: a.label,
    contactName: a.contact_name,
    contactPhone: a.contact_phone,
    addressLine: a.address_line,
    city: a.city,
    pincode: a.pincode,
    landmark: a.landmark,
    isDefault: a.is_default,
  }));
}

export type CheckoutPrefill = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
  landmark: string;
};

/**
 * Returns the signed-in customer's details to pre-fill checkout, or null for a
 * guest. The database function is scoped to the caller's own auth record.
 */
export async function getCheckoutPrefill(): Promise<CheckoutPrefill | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.rpc("my_checkout_prefill");
  if (!data) return null;

  const d = data as Record<string, string>;
  return {
    name: d.name ?? "",
    email: d.email ?? "",
    phone: d.phone ?? "",
    address: d.address ?? "",
    city: d.city ?? "",
    pincode: d.pincode ?? "",
    landmark: d.landmark ?? "",
  };
}

/**
 * Checks a PIN before the customer fills the whole form. The database enforces
 * this again at place_order — this is only so a customer in an unserved area
 * learns that up front, not after typing their address.
 */
export async function checkPincode(
  pincode: string
): Promise<{ served: boolean }> {
  const clean = pincode.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return { served: false };

  const supabase = await createClient();
  const { data: orgId } = await supabase.rpc("storefront_org_id");
  if (!orgId) return { served: true }; // no shop configured — don't block

  // If no zones exist, the shop delivers everywhere (place_order won't block),
  // so a PIN check would be misleading. Only judge when zones are set up.
  const { data: areas } = await supabase.rpc("served_areas");
  if (!areas || (areas as unknown[]).length === 0) return { served: true };

  const { data, error } = await supabase.rpc("delivers_to", {
    p_org: orgId,
    p_pincode: clean,
  });

  if (error) return { served: true };
  return { served: data === true };
}

/**
 * Previews a coupon against the current basket subtotal, so the customer sees
 * the discount before placing the order. The real discount is recomputed by
 * place_order at submit time — this is a preview, never the source of truth.
 */
export async function previewCoupon(
  code: string,
  subtotal: number,
  phone: string
): Promise<{ ok: true; discount: number } | { ok: false; message: string }> {
  if (!code.trim()) return { ok: false, message: "Enter a code." };

  const supabase = await createClient();
  const { data: orgId } = await supabase.rpc("storefront_org_id");
  if (!orgId) return { ok: false, message: "The shop isn't open." };

  const { data, error } = await supabase.rpc("preview_coupon", {
    p_org: orgId,
    p_code: code,
    p_subtotal: subtotal,
    p_phone: phone || "",
  });

  if (error || !data) {
    return { ok: false, message: "Couldn't check that code. Try again." };
  }

  const d = data as { ok?: boolean; discount?: number; message?: string };
  if (!d.ok) return { ok: false, message: d.message ?? "That code isn't valid." };
  return { ok: true, discount: Number(d.discount ?? 0) };
}

/** Attaches a GPS pin to a just-placed order (best-effort). */
export async function attachOrderLocation(
  orderId: string,
  lat: number,
  lng: number
): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("attach_order_location", {
      p_order_id: orderId,
      p_lat: lat,
      p_lng: lng,
    });
  } catch {
    /* best-effort */
  }
}

/**
 * Places the order.
 *
 * Note what is NOT sent from the browser: prices. The client submits product
 * ids and quantities only, and `place_order` looks up the real price itself.
 * Anyone can edit the page they were served — the server must never be told
 * what something costs.
 */
export async function placeOrder(
  form: {
    name: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    pincode: string;
    landmark: string;
    slot: string;
    notes: string;
    coupon: string;
    useCredit: boolean;
    paymentMethod: PaymentMethod;
  },
  lines: SubmittedLine[]
): Promise<PlaceOrderResult> {
  if (!Array.isArray(lines) || lines.length === 0) {
    return { ok: false, message: "Your basket is empty." };
  }

  // The cart comes from the customer's own browser (localStorage), so treat it
  // as untrusted: coerce quantities, drop anything malformed, cap the count.
  // The database re-checks all of this too — this is the friendly first pass.
  const cleanLines = lines
    .filter((l) => l && typeof l.productId === "string")
    .map((l) => ({ product_id: l.productId, quantity: toQuantity(l.quantity, 50) }))
    .filter((l): l is { product_id: string; quantity: number } => l.quantity !== null)
    .slice(0, 40);

  if (cleanLines.length === 0) {
    return { ok: false, message: "Your basket has nothing valid to order." };
  }

  const supabase = await createClient();

  const { data: orgId, error: orgError } = await supabase.rpc(
    "storefront_org_id"
  );

  if (orgError || !orgId) {
    return {
      ok: false,
      message: "The shop isn't taking orders right now. Please try again later.",
    };
  }

  const method: PaymentMethod =
    form.paymentMethod === "upi" || form.paymentMethod === "card"
      ? form.paymentMethod
      : "cod";

  const { data, error } = await supabase.rpc("place_order", {
    p_org_id: orgId,
    p_contact_name: form.name,
    p_contact_phone: form.phone,
    p_contact_email: form.email || null,
    p_address_line: form.address,
    p_city: form.city,
    p_pincode: form.pincode,
    p_landmark: form.landmark,
    p_delivery_slot: form.slot,
    p_notes: form.notes,
    p_lines: cleanLines,
    p_coupon_code: form.coupon || null,
    p_use_credit: form.useCredit === true,
    p_payment_method: method,
  });

  if (error) {
    // The function raises readable exceptions for the cases a customer can
    // actually fix (bad phone, empty basket, item gone). Pass those through;
    // anything else gets a generic message so we don't leak internals.
    const known =
      error.message.includes("mobile") ||
      error.message.includes("required") ||
      error.message.includes("basket") ||
      error.message.includes("available") ||
      error.message.includes("not open");

    return {
      ok: false,
      message: known
        ? error.message
        : "Something went wrong placing your order. Please try again.",
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { ok: false, message: "Order could not be placed. Please try again." };
  }

  return {
    ok: true,
    orderId: String(row.order_id),
    orderNumber: String(row.order_number),
    total: Number(row.total),
    paymentMethod: method,
  };
}

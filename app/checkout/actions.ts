"use server";

import { createClient } from "@/lib/supabase/server";

export type PlaceOrderResult =
  | { ok: true; orderNumber: string; total: number }
  | { ok: false; message: string };

export type SubmittedLine = { productId: string; quantity: number };

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
    address: string;
    city: string;
    pincode: string;
    landmark: string;
    slot: string;
    notes: string;
  },
  lines: SubmittedLine[]
): Promise<PlaceOrderResult> {
  if (!Array.isArray(lines) || lines.length === 0) {
    return { ok: false, message: "Your basket is empty." };
  }

  const supabase = await createClient();

  const { data: orgId, error: orgError } = await supabase.rpc(
    "storefront_org_id"
  );

  if (orgError || !orgId) {
    return {
      ok: false,
      message:
        "The shop isn't open yet. Run migration 0003 and enable the storefront.",
    };
  }

  const { data, error } = await supabase.rpc("place_order", {
    p_org_id: orgId,
    p_contact_name: form.name,
    p_contact_phone: form.phone,
    p_address_line: form.address,
    p_city: form.city,
    p_pincode: form.pincode,
    p_landmark: form.landmark,
    p_delivery_slot: form.slot,
    p_notes: form.notes,
    p_lines: lines.map((l) => ({
      product_id: l.productId,
      quantity: l.quantity,
    })),
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
    orderNumber: String(row.order_number),
    total: Number(row.total),
  };
}

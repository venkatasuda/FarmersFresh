"use server";

import { createClient } from "@/lib/supabase/server";

export type SubResult = { ok: true } | { ok: false; message: string };

/**
 * Subscribes the logged-in customer to a product on a schedule. Delivery
 * details come from their default saved address, falling back to their last
 * order — so subscribing is one tap once they've ordered or saved an address.
 */
export async function createSubscription(
  productId: string,
  quantity: number,
  frequency: "daily" | "weekly" | "monthly"
): Promise<SubResult> {
  if (!(quantity > 0)) return { ok: false, message: "Choose a quantity." };
  if (!["daily", "weekly", "monthly"].includes(frequency)) {
    return { ok: false, message: "Choose a frequency." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please log in to subscribe." };

  const { data: orgId } = await supabase.rpc("storefront_org_id");
  if (!orgId) return { ok: false, message: "The shop isn't open." };

  // Delivery details: default address, else last order via prefill.
  const { data: addr } = await supabase
    .from("customer_addresses")
    .select("*")
    .eq("is_default", true)
    .maybeSingle();

  let name = "",
    phone = "",
    line = "",
    city: string | null = null,
    pincode: string | null = null,
    landmark: string | null = null;

  if (addr) {
    const a = addr as Record<string, string | null>;
    name = a.contact_name ?? "";
    phone = a.contact_phone ?? "";
    line = a.address_line ?? "";
    city = a.city;
    pincode = a.pincode;
    landmark = a.landmark;
  } else {
    const { data: p } = await supabase.rpc("my_checkout_prefill");
    const d = (p ?? {}) as Record<string, string>;
    name = d.name ?? "";
    phone = d.phone ?? "";
    line = d.address ?? "";
    city = d.city ?? null;
    pincode = d.pincode ?? null;
    landmark = d.landmark ?? null;
  }

  if (!name || !/^[6-9]\d{9}$/.test(phone.replace(/\D/g, "").slice(-10)) || !line) {
    return {
      ok: false,
      message: "Add a delivery address to your account first, then subscribe.",
    };
  }

  // First delivery tomorrow.
  const next = new Date();
  next.setDate(next.getDate() + 1);

  const { error } = await supabase.from("subscriptions").insert({
    org_id: orgId,
    user_id: user.id,
    product_id: productId,
    quantity,
    frequency,
    next_run: next.toISOString().slice(0, 10),
    contact_name: name,
    contact_phone: phone.replace(/\D/g, "").slice(-10),
    address_line: line,
    city,
    pincode,
    landmark,
  });

  if (error) return { ok: false, message: "Couldn't set up the subscription." };
  return { ok: true };
}

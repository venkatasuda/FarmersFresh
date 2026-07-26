"use server";

import { createClient } from "@/lib/supabase/server";

export type MySubscription = {
  id: string;
  product_id: string;
  product_name: string;
  image_path: string | null;
  quantity: number;
  frequency: "daily" | "weekly" | "monthly";
  status: "active" | "paused";
  next_run: string | null;
};

/** The logged-in customer's subscriptions, newest first. */
export async function getMySubscriptions(): Promise<MySubscription[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "id, product_id, quantity, frequency, status, next_run, products(name, image_path)"
    )
    .order("created_at", { ascending: false });

  if (error || !Array.isArray(data)) return [];

  return (data as unknown[]).map((row) => {
    const r = row as Record<string, unknown>;
    const p = (r.products ?? {}) as Record<string, unknown>;
    return {
      id: String(r.id),
      product_id: String(r.product_id),
      product_name: String(p.name ?? "Product"),
      image_path: (p.image_path as string | null) ?? null,
      quantity: Number(r.quantity) || 0,
      frequency: (r.frequency as MySubscription["frequency"]) ?? "weekly",
      status: (r.status as MySubscription["status"]) ?? "active",
      next_run: (r.next_run as string | null) ?? null,
    };
  });
}

export type SubActionResult = { ok: boolean };

/** Pause or resume — RLS scopes the update to the caller's own rows. */
export async function setSubscriptionStatus(
  id: string,
  status: "active" | "paused"
): Promise<SubActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("subscriptions")
    .update({ status })
    .eq("id", id);
  return { ok: !error };
}

/** Cancel for good. */
export async function cancelSubscription(id: string): Promise<SubActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase.from("subscriptions").delete().eq("id", id);
  return { ok: !error };
}

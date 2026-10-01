import "server-only";
import type { MySubscription, SubActionResult } from "@/lib/contracts/account-subscription";
import { createClient } from "@/server/supabase/server";

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
      "id, product_id, quantity, frequency, is_active, next_run, products(name, image_path)"
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
      is_active: Boolean(r.is_active),
      next_run: (r.next_run as string | null) ?? null,
    };
  });
}

/** Pause or resume — RLS scopes the update to the caller's own rows. */
export async function setSubscriptionActive(
  id: string,
  isActive: boolean
): Promise<SubActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("subscriptions")
    .update({ is_active: isActive })
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

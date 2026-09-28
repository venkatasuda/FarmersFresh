"use server";

import { createClient } from "@/lib/supabase/server";

export type Plan = {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  discountPercent: number;
};

export type Membership = {
  active: boolean;
  expiresAt: string;
  plan: string;
  discountPercent: number;
} | null;

export async function getPlans(): Promise<Plan[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_membership_plans");
  return ((data ?? []) as Record<string, unknown>[]).map((p) => ({
    id: String(p.id),
    name: String(p.name ?? ""),
    price: Number(p.price ?? 0),
    durationDays: Number(p.duration_days ?? 0),
    discountPercent: Number(p.discount_percent ?? 0),
  }));
}

export async function getMyMembership(): Promise<Membership> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_membership");
  if (!data) return null;
  const d = data as Record<string, unknown>;
  return {
    active: true,
    expiresAt: String(d.expires_at ?? ""),
    plan: String(d.plan ?? "Pass"),
    discountPercent: Number(d.discount_percent ?? 0),
  };
}

/** Creates a pending membership and returns its id for the payment step. */
export async function startMembership(
  planId: string
): Promise<{ ok: true; membershipId: string } | { ok: false; message: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_membership", { p_plan: planId });
  if (error) return { ok: false, message: "Couldn't start. Please try again." };
  const d = (data ?? {}) as { ok?: boolean; membership_id?: string; message?: string };
  if (!d.ok || !d.membership_id) {
    return { ok: false, message: d.message ?? "Couldn't start. Please try again." };
  }
  return { ok: true, membershipId: d.membership_id };
}

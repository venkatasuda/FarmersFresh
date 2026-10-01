import "server-only";
import type { Savings, Wallet } from "@/lib/contracts/account-wallet";
import { createClient } from "@/server/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Lifetime savings for the signed-in customer — the proof behind our
 * fair-pricing promise. Only counts genuine savings (discounts actually given
 * + free deliveries), never inflated-MRP theatre. Returns null for guests.
 */
export async function getMySavings(): Promise<Savings | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.rpc("my_savings");
  if (!data) return null;
  const d = data as {
    total_discount?: number;
    free_deliveries?: number;
    order_count?: number;
  };
  return {
    totalDiscount: Number(d.total_discount ?? 0),
    freeDeliveries: Number(d.free_deliveries ?? 0),
    orderCount: Number(d.order_count ?? 0),
  };
}

export async function getMyWallet(): Promise<Wallet | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.rpc("my_wallet");
  if (!data) return null;
  const d = data as { balance?: number; code?: string; referred?: boolean };
  return {
    balance: Number(d.balance ?? 0),
    code: d.code ?? "",
    referred: !!d.referred,
  };
}

export async function redeemReferral(
  code: string
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_referral", {
    p_code: code,
  });
  if (error) return { ok: false, message: "Couldn't apply that code." };
  const d = data as { ok?: boolean; message?: string };
  if (!d.ok) return { ok: false, message: d.message ?? "That code isn't valid." };
  revalidatePath("/account");
  return { ok: true, message: d.message ?? "Applied!" };
}

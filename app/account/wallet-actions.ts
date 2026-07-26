"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type Wallet = { balance: number; code: string; referred: boolean };

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

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setShift(on: boolean): Promise<boolean> {
  const supabase = await createClient();
  await supabase.rpc("set_my_shift", { p_on: on });
  revalidatePath("/dashboard/deliveries");
  return on;
}

export async function autoAssign(): Promise<
  { ok: true; count: number } | { ok: false; message: string }
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("auto_assign_deliveries");
  if (error) return { ok: false, message: "Couldn't auto-assign — check on-shift riders." };
  revalidatePath("/dashboard/deliveries");
  return { ok: true, count: Number(data ?? 0) };
}

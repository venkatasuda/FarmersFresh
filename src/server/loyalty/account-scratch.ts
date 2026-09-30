import "server-only";
import type { ScratchCard } from "@/lib/contracts/account-scratch";
import { createClient } from "@/server/supabase/server";

export async function getMyScratchCards(): Promise<ScratchCard[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_scratch_cards");
  return ((data ?? []) as Record<string, unknown>[]).map((c) => ({
    id: String(c.id),
    orderNumber: String(c.order_number),
  }));
}

export async function revealScratchCard(
  id: string
): Promise<{ ok: true; points: number } | { ok: false }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reveal_scratch_card", { p_id: id });
  if (error) return { ok: false };
  return { ok: true, points: Number(data ?? 0) };
}

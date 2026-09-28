"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Checks whether the shop delivers to a PIN, and returns the area name if it's
 * a listed zone. Mirrors checkout's guard so the header widget and checkout
 * agree. If the shop has no zones set up, everywhere is served.
 */
export async function checkLocation(
  pincode: string
): Promise<{ served: boolean; area: string | null }> {
  const clean = pincode.replace(/\D/g, "");
  if (!/^\d{6}$/.test(clean)) return { served: false, area: null };

  const supabase = await createClient();
  const { data: orgId } = await supabase.rpc("storefront_org_id");
  if (!orgId) return { served: true, area: null };

  const { data: areas } = await supabase.rpc("served_areas");
  const list = (areas ?? []) as { pincode: string; area_name: string | null }[];

  // No zones configured → delivers everywhere.
  if (list.length === 0) return { served: true, area: null };

  const match = list.find((a) => a.pincode === clean);
  return { served: !!match, area: match?.area_name ?? null };
}

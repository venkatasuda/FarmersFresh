import "server-only";
import { createClient } from "@/server/supabase/server";

export async function hasPermission(capability: "financials.read" | "orders.manage" | "inventory.adjust" | "procurement.manage"): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_permission", { p_capability: capability });
  return !error && data === true;
}

export async function getOperationalLocations(capability: "inventory.adjust" | "procurement.manage"): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("operational_locations", { p_capability: capability });
  if (error || !Array.isArray(data)) throw new Error("Store access is temporarily unavailable.");
  return data as { id: string; name: string }[];
}

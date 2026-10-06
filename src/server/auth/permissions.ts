import "server-only";
import { createClient } from "@/server/supabase/server";

export async function hasPermission(capability: "financials.read" | "orders.manage"): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_permission", { p_capability: capability });
  return !error && data === true;
}

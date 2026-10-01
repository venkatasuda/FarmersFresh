import "server-only";
import { createClient } from "@/server/supabase/server";

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getMyOrders() {
  const supabase = await createClient();
  return supabase.rpc("my_orders");
}

export async function getMyTier() {
  const supabase = await createClient();
  return supabase.rpc("my_tier");
}

export async function getSupportContacts() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("notify_phone, notify_email")
    .not("notify_phone", "is", null)
    .maybeSingle();
  return data as { notify_phone: string | null; notify_email: string | null } | null;
}

"use server";

import { createClient } from "@/lib/supabase/server";

/** Stores a device's Web Push subscription against the logged-in customer. */
export async function savePushSubscription(sub: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: sub.endpoint,
    p_p256dh: sub.p256dh,
    p_auth: sub.auth,
  });
  return { ok: !error };
}

/** Forgets a device subscription (customer turned notifications off). */
export async function deletePushSubscription(
  endpoint: string
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  await supabase.rpc("delete_push_subscription", { p_endpoint: endpoint });
  return { ok: true };
}

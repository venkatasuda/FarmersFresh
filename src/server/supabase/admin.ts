import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Payment adapters validate configuration before requesting this privileged client. */
export function createAdminClient(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

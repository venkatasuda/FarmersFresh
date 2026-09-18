import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

// Supabase client for use in Client Components ("use client").
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey());
}

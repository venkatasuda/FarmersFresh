import "server-only";
import { createClient } from "@/server/supabase/server";
import { redirect } from "next/navigation";

export async function signOutCustomer() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

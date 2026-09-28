"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Only allow redirects back into this app. `//evil.com` is a valid relative
 * URL to the browser but a valid absolute one to the network — reject it.
 */
function safeNext(value: unknown): string {
  const next = typeof value === "string" ? value : "";
  if (next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!email || !password) {
    redirect(
      `/login?error=${encodeURIComponent("Enter your email and password.")}&next=${encodeURIComponent(next)}`
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Deliberately vague: never reveal whether the email exists.
    redirect(
      `/login?error=${encodeURIComponent("Wrong email or password.")}&next=${encodeURIComponent(next)}`
    );
  }

  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

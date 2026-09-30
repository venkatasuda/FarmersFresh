import "server-only";
import { createClient } from "@/server/supabase/server";
import { redirect } from "next/navigation";

import { safeNext } from "@/lib/guard";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254 || !password || password.length > 1024) {
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

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Customer login — email + password, Amazon style. A signed-out visitor signs
 * in here; if they don't have an account, the "Create account" button sits
 * below (secondary, not competing with sign-in).
 *
 * Uses Supabase Auth email/password. Confirmation emails are sent by Supabase,
 * so this works without any external provider.
 */
export function LoginClient() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shown after a successful sign-up redirects here.
  const justConfirmed = params.get("confirmed") === "1";
  const justSignedUp = params.get("check") === "1";

  async function signIn() {
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        setError(
          error.message.toLowerCase().includes("confirm")
            ? "Please confirm your email first — check your inbox for the link."
            : "Wrong email or password."
        );
        return;
      }
      router.push("/account");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Log in</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Sign in to see your orders and check out faster.
      </p>

      {justConfirmed ? (
        <p className="mt-4 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800">
          Email confirmed — you can log in now.
        </p>
      ) : null}
      {justSignedUp ? (
        <p className="mt-4 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800">
          Almost there — we&apos;ve emailed you a confirmation link. Click it,
          then log in.
        </p>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          signIn();
        }}
        className="mt-6 space-y-4 rounded-2xl border border-line bg-surface p-6"
      >
        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        ) : null}

        <label className="block">
          <span className="text-sm font-medium text-ink">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-ink">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className={inputClass}
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Log in"}
        </button>
      </form>

      {/* Sign-up, pushed below the fold like Amazon — a divider then a
          secondary button, so it never competes with returning customers. */}
      <div className="mt-6">
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-xs text-ink-soft">New to Farmers Fresh?</span>
          <span className="h-px flex-1 bg-line" />
        </div>
        <Link
          href="/account/signup"
          className="mt-3 block rounded-lg border border-line bg-surface px-4 py-2.5 text-center text-sm font-medium text-ink transition-colors hover:border-brand-300 hover:text-brand-700"
        >
          Create your account
        </Link>
      </div>

      <p className="mt-4 text-center text-xs text-ink-soft">
        No account needed to order — you can always check out as a guest.
      </p>
    </div>
  );
}

const inputClass =
  "mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand-500";

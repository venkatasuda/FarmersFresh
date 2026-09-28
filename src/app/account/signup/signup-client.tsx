"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Customer sign-up — name, email, password. On submit, Supabase creates the
 * account and emails a confirmation link; the user clicks it, then logs in.
 * Nothing is usable until the email is confirmed, which is the Amazon flow the
 * owner asked for.
 */
export function SignupClient() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setError(null);
    if (!name.trim()) return setError("Enter your name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()))
      return setError("Enter a valid email address.");
    if (password.length < 6)
      return setError("Use a password of at least 6 characters.");

    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { full_name: name.trim() },
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });
      if (error) {
        setError(
          error.message.toLowerCase().includes("registered") ||
            error.message.toLowerCase().includes("exists")
            ? "That email already has an account — try logging in."
            : error.message
        );
        return;
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-sm text-center">
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden>
            <path
              d="M4 7l8 6 8-6M4 7h16v10H4V7Z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h1 className="text-xl font-semibold text-ink">Check your email</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-ink-soft">
          We&apos;ve sent a confirmation link to{" "}
          <span className="font-medium text-ink">{email}</span>. Click it to
          activate your account, then log in.
        </p>
        <Link
          href="/account/login"
          className="mt-5 inline-block rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        Create your account
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        So your orders and addresses are saved for next time.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
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
          <span className="text-sm font-medium text-ink">Full name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className={inputClass}
          />
        </label>
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
            autoComplete="new-password"
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-ink-soft">
            At least 6 characters.
          </span>
        </label>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/account/login" className="font-medium text-brand-700 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

const inputClass =
  "mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand-500";

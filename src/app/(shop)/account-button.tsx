"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Header account entry point, next to the basket. Shows "Login" for a guest
 * and a person icon linking to the account once signed in. Checks the session
 * on the client so the storefront stays server-rendered and cached.
 */
export function AccountButton() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));

    // Keep the button in step if they log in/out in another tab.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session?.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Link
      href={signedIn ? "/account" : "/account/login"}
      className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-brand-50 hover:text-brand-700"
      aria-label={signedIn ? "My account" : "Log in"}
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
        <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M5.5 19.5a6.5 6.5 0 0 1 13 0"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
      <span className="hidden sm:inline">
        {signedIn ? "Account" : "Login"}
      </span>
    </Link>
  );
}

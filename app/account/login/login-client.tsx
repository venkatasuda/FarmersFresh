"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Customer login by phone OTP — the Indian standard (Swiggy/Zepto/BigBasket),
 * no password to remember. Two steps: enter mobile → enter the 6-digit code.
 *
 * Because the whole system already keys customers on phone, logging in simply
 * connects them to the orders they've already placed. Sending the code needs
 * Supabase Phone Auth enabled with an SMS provider (the same MSG91/Twilio you
 * set up for notifications) — until then this shows a clear message rather
 * than failing silently.
 */
export function LoginClient() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Supabase wants E.164; India is +91 + 10 digits.
  const e164 = () => "+91" + phone.replace(/\D/g, "").slice(-10);

  async function sendCode() {
    setError(null);
    const clean = phone.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(clean)) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({ phone: e164() });
      if (error) {
        setError(
          error.message.toLowerCase().includes("provider") ||
            error.message.toLowerCase().includes("phone")
            ? "Phone login isn't switched on yet. Please order as a guest for now."
            : error.message
        );
        return;
      }
      setStep("code");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setError(null);
    if (!/^\d{4,8}$/.test(code.trim())) {
      setError("Enter the code we sent you.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        phone: e164(),
        token: code.trim(),
        type: "sms",
      });
      if (error) {
        setError("That code didn't match. Check it and try again.");
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
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        Log in
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        Sign in with your mobile number to see your orders and check out faster.
      </p>

      <div className="mt-6 space-y-4 rounded-2xl border border-line bg-surface p-6">
        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        ) : null}

        {step === "phone" ? (
          <>
            <label className="block">
              <span className="text-sm font-medium text-ink">Mobile number</span>
              <div className="mt-1.5 flex items-center rounded-lg border border-line bg-surface focus-within:border-brand-500">
                <span className="px-3 text-sm text-ink-soft">+91</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10-digit number"
                  className="w-full rounded-r-lg bg-transparent py-2.5 pr-3 text-sm text-ink outline-none"
                  onKeyDown={(e) => e.key === "Enter" && sendCode()}
                />
              </div>
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={sendCode}
              className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send code"}
            </button>
          </>
        ) : (
          <>
            <label className="block">
              <span className="text-sm font-medium text-ink">
                Enter the code sent to +91 {phone}
              </span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                placeholder="6-digit code"
                className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-center text-lg tracking-widest text-ink outline-none focus:border-brand-500"
                onKeyDown={(e) => e.key === "Enter" && verify()}
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={verify}
              className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {busy ? "Checking…" : "Verify & log in"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setCode("");
                setError(null);
              }}
              className="w-full text-center text-sm text-ink-soft hover:text-ink"
            >
              Change number
            </button>
          </>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-ink-soft">
        No account needed to order — you can always check out as a guest.
      </p>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useCart } from "@/app/(shop)/cart-context";
import { formatLineQty, formatRupees } from "@/lib/format";
import { deliveryFeeFor } from "@/lib/types";
import {
  checkPincode,
  getCheckoutPrefill,
  placeOrder,
  previewCoupon,
} from "./actions";
import { getMyWallet } from "@/app/account/wallet-actions";

const SLOTS = [
  { value: "today_evening", label: "Today, 4–8 pm" },
  { value: "tomorrow_morning", label: "Tomorrow, 7–11 am" },
  { value: "tomorrow_evening", label: "Tomorrow, 4–8 pm" },
];

/**
 * Checkout body. Split from the route so `ShopShell` (an async Server
 * Component that loads categories) can wrap it — a Client Component cannot
 * render an async Server Component.
 */
export function CheckoutClient() {
  const router = useRouter();
  const { lines, subtotal, clear, ready } = useCart();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [slot, setSlot] = useState(SLOTS[0].value);
  // null = not checked yet, true/false = result of the last PIN check
  const [pinServed, setPinServed] = useState<boolean | null>(null);
  const [checkingPin, setCheckingPin] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [useCredit, setUseCredit] = useState(false);

  // Coupon: the applied code + the discount the server confirmed. Both are
  // re-validated by place_order at submit — this is only the friendly preview.
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  const fee = deliveryFeeFor(subtotal);
  const afterDiscount = Math.max(subtotal - discount, 0);
  // Wallet credit is applied against the amount due before delivery, capped at
  // the balance. The server recomputes this — the UI is a preview.
  const creditApplied = useCredit ? Math.min(walletBalance, afterDiscount) : 0;
  const grandTotal = Math.max(afterDiscount - creditApplied, 0) + fee;

  async function applyCoupon() {
    setCouponMsg(null);
    const phone =
      (document.querySelector('input[name="phone"]') as HTMLInputElement | null)
        ?.value ?? "";
    setApplyingCoupon(true);
    try {
      const r = await previewCoupon(couponInput, subtotal, phone);
      if (!r.ok) {
        setCoupon(null);
        setDiscount(0);
        setCouponMsg(r.message);
        return;
      }
      setCoupon(couponInput.trim().toUpperCase());
      setDiscount(r.discount);
      setCouponMsg(null);
    } finally {
      setApplyingCoupon(false);
    }
  }

  function removeCoupon() {
    setCoupon(null);
    setDiscount(0);
    setCouponInput("");
    setCouponMsg(null);
  }

  // Prefill for a returning customer: their account + last order details fill
  // the form, so checkout is almost one tap. Falls back to the saved header
  // location for the PIN when they're a guest. Uncontrolled fields, so we set
  // values on the DOM after mount.
  useEffect(() => {
    function setField(name: string, value: string) {
      if (!value) return;
      const el = document.querySelector(
        `[name="${name}"]`
      ) as HTMLInputElement | HTMLTextAreaElement | null;
      if (el && !el.value) el.value = value;
    }

    // Wallet balance, for the "use credit" option (logged-in customers).
    getMyWallet().then((w) => {
      if (w) setWalletBalance(w.balance);
    });

    let done = false;
    getCheckoutPrefill().then((p) => {
      done = true;
      if (p) {
        setField("name", p.name);
        setField("phone", p.phone);
        setField("email", p.email);
        setField("address", p.address);
        setField("city", p.city);
        setField("landmark", p.landmark);
        setField("pincode", p.pincode);
        if (p.pincode) void onPincodeBlur(p.pincode);
        if (p.name || p.address) setPrefilled(true);
      }
    });

    // Guest fallback: the header location PIN, if the prefill didn't cover it.
    try {
      const raw = window.localStorage.getItem("ff.location.v1");
      if (raw) {
        const loc = JSON.parse(raw) as { pincode?: string };
        const el = document.querySelector(
          'input[name="pincode"]'
        ) as HTMLInputElement | null;
        if (!done && el && loc.pincode && !el.value) {
          el.value = loc.pincode;
          void onPincodeBlur(loc.pincode);
        }
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onPincodeBlur(value: string) {
    const clean = value.replace(/\s/g, "");
    if (!/^\d{6}$/.test(clean)) {
      setPinServed(null);
      return;
    }
    setCheckingPin(true);
    try {
      const { served } = await checkPincode(clean);
      setPinServed(served);
    } finally {
      setCheckingPin(false);
    }
  }

  if (ready && lines.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center">
        <h1 className="text-lg font-medium text-ink">Nothing to check out</h1>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mt-4 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Back to the shop
        </button>
      </div>
    );
  }

  function handleSubmit(formData: FormData) {
    setError(null);

    const form = {
      name: String(formData.get("name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? ""),
      address: String(formData.get("address") ?? ""),
      city: String(formData.get("city") ?? ""),
      pincode: String(formData.get("pincode") ?? ""),
      landmark: String(formData.get("landmark") ?? ""),
      slot: String(formData.get("slot") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      coupon: coupon ?? "",
      useCredit,
    };

    // Product ids and quantities only — never prices. The database re-prices.
    const submitted = lines.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
    }));

    startTransition(async () => {
      const result = await placeOrder(form, submitted);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      clear();
      router.push(
        `/order-placed?number=${encodeURIComponent(result.orderNumber)}&total=${result.total}`
      );
    });
  }

  return (
    <>
      <h1 className="mb-5 text-2xl font-semibold tracking-tight text-ink">
        Where should we deliver?
      </h1>

      {prefilled ? (
        <p className="mb-4 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800">
          Welcome back — we&apos;ve filled in your details. Just check them and
          place your order.
        </p>
      ) : null}

      <form action={handleSubmit} className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          ) : null}

          <div className="rounded-2xl border border-line bg-surface p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="name" label="Your name" required autoComplete="name" />
              <Field
                name="phone"
                label="Mobile number"
                required
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                hint="10 digits — we'll call before delivery"
              />
            </div>

            <div className="mt-4">
              <Field
                name="email"
                label="Email (optional)"
                type="email"
                autoComplete="email"
                hint="For your order confirmation and receipt by email"
              />
            </div>

            <div className="mt-4">
              <Field
                name="address"
                label="Address"
                required
                autoComplete="street-address"
                textarea
              />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field name="city" label="City / town" autoComplete="address-level2" />
              <Field
                name="pincode"
                label="PIN code"
                inputMode="numeric"
                autoComplete="postal-code"
                onBlur={(e) => void onPincodeBlur(e.currentTarget.value)}
              />
              <Field name="landmark" label="Landmark" />
            </div>

            {checkingPin ? (
              <p className="mt-2 text-sm text-ink-soft">Checking delivery…</p>
            ) : pinServed === true ? (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-brand-700">
                <span aria-hidden>✓</span> We deliver to your area.
              </p>
            ) : pinServed === false ? (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                We don&apos;t deliver to that PIN code yet. You can still browse,
                and we&apos;re adding new areas often.
              </p>
            ) : null}
          </div>

          <fieldset className="rounded-2xl border border-line bg-surface p-5">
            <legend className="px-1 text-sm font-medium text-ink">
              Delivery time
            </legend>
            <div className="mt-2 space-y-2">
              {SLOTS.map((s) => (
                <label
                  key={s.value}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
                    slot === s.value
                      ? "border-brand-500 bg-brand-50 text-brand-900"
                      : "border-line text-ink hover:border-brand-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="slot"
                    value={s.value}
                    checked={slot === s.value}
                    onChange={() => setSlot(s.value)}
                    className="accent-brand-600"
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="rounded-2xl border border-line bg-surface p-5">
            <Field
              name="notes"
              label="Anything we should know?"
              textarea
              hint="Cutting preference, gate code, best time to call"
            />
          </div>
        </div>

        <aside className="h-fit rounded-2xl border border-line bg-surface p-5 lg:sticky lg:top-36">
          <h2 className="text-sm font-medium text-ink">Your order</h2>

          <ul className="mt-3 space-y-2 text-sm">
            {lines.map((l) => (
              <li key={l.productId} className="flex justify-between gap-3">
                <span className="text-ink-soft">
                  {l.name}{" "}
                  <span className="text-xs">
                    ({formatLineQty(l.quantity, l.unit, l.packLabel)})
                  </span>
                </span>
                <span className="tabular-nums text-ink">
                  {formatRupees(l.price * l.quantity)}
                </span>
              </li>
            ))}
          </ul>

          {/* Coupon */}
          <div className="mt-4 border-t border-line pt-4">
            {coupon ? (
              <div className="flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2 text-sm">
                <span className="font-medium text-brand-800">
                  {coupon} applied
                </span>
                <button
                  type="button"
                  onClick={removeCoupon}
                  className="text-xs text-ink-soft hover:text-red-600"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="Coupon code"
                  className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm uppercase outline-none focus:border-brand-500"
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={applyingCoupon || !couponInput.trim()}
                  className="rounded-lg border border-brand-300 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50"
                >
                  {applyingCoupon ? "…" : "Apply"}
                </button>
              </div>
            )}
            {couponMsg ? (
              <p className="mt-1.5 text-xs text-red-600">{couponMsg}</p>
            ) : null}
          </div>

          {/* Wallet credit */}
          {walletBalance > 0 ? (
            <label className="mt-4 flex items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5">
              <span className="text-sm text-brand-900">
                Use wallet credit
                <span className="block text-xs text-brand-700">
                  {formatRupees(walletBalance)} available
                </span>
              </span>
              <input
                type="checkbox"
                checked={useCredit}
                onChange={(e) => setUseCredit(e.target.checked)}
                className="size-4 accent-brand-600"
              />
            </label>
          ) : null}

          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Subtotal</dt>
              <dd className="tabular-nums text-ink">{formatRupees(subtotal)}</dd>
            </div>
            {discount > 0 ? (
              <div className="flex justify-between">
                <dt className="text-brand-700">Discount</dt>
                <dd className="font-medium text-brand-700 tabular-nums">
                  −{formatRupees(discount)}
                </dd>
              </div>
            ) : null}
            {creditApplied > 0 ? (
              <div className="flex justify-between">
                <dt className="text-brand-700">Wallet credit</dt>
                <dd className="font-medium text-brand-700 tabular-nums">
                  −{formatRupees(creditApplied)}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-ink-soft">Delivery</dt>
              <dd className={fee === 0 ? "font-medium text-brand-700" : "text-ink"}>
                {fee === 0 ? "Free" : formatRupees(fee)}
              </dd>
            </div>
          </dl>

          <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
            <span className="font-medium text-ink">Pay on delivery</span>
            <span className="text-xl font-semibold text-ink tabular-nums">
              {formatRupees(grandTotal)}
            </span>
          </div>

          <button
            type="submit"
            disabled={pending || pinServed === false}
            className="mt-5 w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            {pending
              ? "Placing order…"
              : pinServed === false
                ? "Out of delivery area"
                : "Place order"}
          </button>

          <p className="mt-3 text-center text-xs text-ink-soft">
            Final price follows the weighed cut. We&apos;ll confirm by phone.
          </p>
        </aside>
      </form>
    </>
  );
}

function Field({
  name,
  label,
  hint,
  textarea = false,
  ...rest
}: {
  name: string;
  label: string;
  hint?: string;
  textarea?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const classes =
    "mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand-500";

  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-ink">
        {label}
        {rest.required ? <span className="text-brand-600"> *</span> : null}
      </label>
      {textarea ? (
        <textarea
          id={name}
          name={name}
          rows={3}
          required={rest.required}
          className={classes}
        />
      ) : (
        <input id={name} name={name} {...rest} className={classes} />
      )}
      {hint ? <p className="mt-1 text-xs text-ink-soft">{hint}</p> : null}
    </div>
  );
}

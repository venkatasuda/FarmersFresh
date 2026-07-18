"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useCart } from "@/app/(shop)/cart-context";
import { ShopShell } from "@/app/(shop)/shop-shell";
import { formatQty, formatRupees } from "@/lib/shop";
import { placeOrder } from "./actions";

const SLOTS = [
  { value: "today_evening", label: "Today, 4–8 pm" },
  { value: "tomorrow_morning", label: "Tomorrow, 7–11 am" },
  { value: "tomorrow_evening", label: "Tomorrow, 4–8 pm" },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { lines, subtotal, clear, ready } = useCart();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [slot, setSlot] = useState(SLOTS[0].value);

  const fee = subtotal >= 500 || subtotal === 0 ? 0 : 40;

  if (ready && lines.length === 0) {
    return (
      <ShopShell>
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
      </ShopShell>
    );
  }

  function handleSubmit(formData: FormData) {
    setError(null);

    const form = {
      name: String(formData.get("name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      address: String(formData.get("address") ?? ""),
      city: String(formData.get("city") ?? ""),
      pincode: String(formData.get("pincode") ?? ""),
      landmark: String(formData.get("landmark") ?? ""),
      slot: String(formData.get("slot") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    };

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
    <ShopShell>
      <h1 className="mb-5 text-2xl font-semibold tracking-tight text-ink">
        Where should we deliver?
      </h1>

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
              />
              <Field name="landmark" label="Landmark" />
            </div>
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

        <aside className="h-fit rounded-2xl border border-line bg-surface p-5 lg:sticky lg:top-20">
          <h2 className="text-sm font-medium text-ink">Your order</h2>

          <ul className="mt-3 space-y-2 text-sm">
            {lines.map((l) => (
              <li key={l.productId} className="flex justify-between gap-3">
                <span className="text-ink-soft">
                  {l.name}{" "}
                  <span className="text-xs">
                    ({formatQty(l.quantity, l.unit)})
                  </span>
                </span>
                <span className="tabular-nums text-ink">
                  {formatRupees(l.price * l.quantity)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Subtotal</dt>
              <dd className="tabular-nums text-ink">{formatRupees(subtotal)}</dd>
            </div>
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
              {formatRupees(subtotal + fee)}
            </span>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="mt-5 w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            {pending ? "Placing order…" : "Place order"}
          </button>

          <p className="mt-3 text-center text-xs text-ink-soft">
            Final price follows the weighed cut. We&apos;ll confirm by phone.
          </p>
        </aside>
      </form>
    </ShopShell>
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
        <textarea id={name} name={name} rows={3} required={rest.required} className={classes} />
      ) : (
        <input id={name} name={name} {...rest} className={classes} />
      )}
      {hint ? <p className="mt-1 text-xs text-ink-soft">{hint}</p> : null}
    </div>
  );
}

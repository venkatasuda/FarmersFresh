"use client";

import { useState, useTransition } from "react";
import { saveSettings, type AdminSettings } from "./actions";

export function SettingsForm({ initial }: { initial: AdminSettings }) {
  const [form, setForm] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof AdminSettings>(key: K, value: AdminSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await saveSettings(form);
      if (r.ok) setSaved(true);
      else setError(r.message ?? "Couldn't save. Try again.");
    });
  }

  return (
    <div className="space-y-6">
      <Section title="Shop details" subtitle="How the shop presents itself to customers.">
        <Text label="Store name" value={form.name} onChange={(v) => set("name", v)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Text
            label="Support email"
            value={form.supportEmail}
            onChange={(v) => set("supportEmail", v)}
            hint="Shown to customers who need help"
          />
          <Text
            label="Support phone"
            value={form.supportPhone}
            onChange={(v) => set("supportPhone", v)}
          />
        </div>
      </Section>

      <Section
        title="Delivery charges"
        subtitle="These drive what customers are charged at checkout."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Num
            label="Free delivery over (₹)"
            value={form.freeDeliveryThreshold}
            onChange={(v) => set("freeDeliveryThreshold", v)}
          />
          <Num
            label="Delivery fee below that (₹)"
            value={form.deliveryFee}
            onChange={(v) => set("deliveryFee", v)}
          />
        </div>
        <div className="mt-4">
          <Num
            label="Max total discount (% of order)"
            value={form.maxDiscountPercent}
            onChange={(v) => set("maxDiscountPercent", v)}
          />
          <p className="mt-1 text-xs text-ink-soft">
            A safety cap: coupons + member discount can never take more than this
            off an order, so you can&apos;t sell at a loss. Loyalty points aren&apos;t
            counted here.
          </p>
        </div>
      </Section>

      <Section
        title="Subscribe & Save"
        subtitle="The standing discount on every recurring (subscription) delivery."
      >
        <Num
          label="Subscriber discount (% off each order)"
          value={form.subscriptionDiscountPercent}
          onChange={(v) => set("subscriptionDiscountPercent", v)}
        />
        <p className="mt-1 text-xs text-ink-soft">
          Rewards customers who commit to repeat delivery. A modest 3–5% usually
          converts well without hurting margin. Set to 0 to turn it off. Capped
          at 50%.
        </p>
      </Section>

      <Section
        title="Order alerts"
        subtitle="Where new orders are announced to your team (not shown to customers)."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Text
            label="Notify email"
            value={form.notifyEmail}
            onChange={(v) => set("notifyEmail", v)}
          />
          <Text
            label="Notify phone (SMS / WhatsApp)"
            value={form.notifyPhone}
            onChange={(v) => set("notifyPhone", v)}
          />
        </div>
      </Section>

      <Section title="Business details" subtitle="Appear on receipts and invoices.">
        <Text label="GSTIN" value={form.gstin} onChange={(v) => set("gstin", v)} />
        <Text
          label="Business address"
          value={form.businessAddress}
          onChange={(v) => set("businessAddress", v)}
          textarea
        />
      </Section>

      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
        {saved ? <span className="text-sm text-brand-700">Saved ✓</span> : null}
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {subtitle ? <p className="mt-0.5 text-xs text-ink-soft">{subtitle}</p> : null}
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

function Text({
  label,
  value,
  onChange,
  hint,
  textarea = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  textarea?: boolean;
}) {
  const cls =
    "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-500";
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className={cls} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
      {hint ? <span className="mt-1 block text-xs text-ink-soft">{hint}</span> : null}
    </label>
  );
}

function Num({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      <input
        type="number"
        min="0"
        step="1"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Math.max(0, Number.parseFloat(e.target.value) || 0))}
        className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm tabular-nums outline-none focus:border-brand-500"
      />
    </label>
  );
}

/**
 * Shared dashboard UI primitives. Presentational only (no server imports), so
 * client and server screens can both use them. Extracted to stop the
 * `rounded-2xl border border-line bg-surface` / button-class drift across ~15
 * screens — new screens get the house style for free.
 */
import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-line bg-surface shadow-soft ${hover ? "ff-hover-lift" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function Kpi({
  label,
  value,
  hint,
  tone = "ink",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "ink" | "brand" | "red" | "amber";
}) {
  const color =
    tone === "brand"
      ? "text-brand-700"
      : tone === "red"
        ? "text-red-600"
        : tone === "amber"
          ? "text-amber-700"
          : "text-ink";
  return (
    <Card className="p-4">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight tabular-nums ${color}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-soft">{hint}</p> : null}
    </Card>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      {subtitle ? <p className="mt-1 max-w-2xl text-sm text-ink-soft">{subtitle}</p> : null}
    </div>
  );
}

const BTN_BASE =
  "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:pointer-events-none";
const BTN_VARIANT = {
  primary: "bg-brand-600 text-white hover:bg-brand-700",
  ghost: "border border-line text-ink hover:border-brand-300 hover:text-brand-700",
} as const;

export function Button({
  children,
  variant = "primary",
  className = "",
  ...rest
}: {
  variant?: keyof typeof BTN_VARIANT;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${BTN_BASE} ${BTN_VARIANT[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

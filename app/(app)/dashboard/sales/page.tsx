import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { formatRupees } from "@/lib/format";
import { getSalesSummary, methodLabel } from "@/lib/analytics";

export const metadata = { title: "Sales · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const session = await requireSession();

  if (!session.isOwner) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-14 text-center">
        <h1 className="text-lg font-medium text-ink">Owners only</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
          Sales figures are visible to the account owner.
        </p>
      </div>
    );
  }

  const s = await getSalesSummary();
  if (!s) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-14 text-center">
        <h1 className="text-lg font-medium text-ink">No figures yet</h1>
      </div>
    );
  }

  const methodTotal = s.methodSplit.reduce((sum, m) => sum + m.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Sales</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Counter and online together. Figures in your local time.
        </p>
      </div>

      {/* Headline cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Today" value={formatRupees(s.todaySales)} sub={`${s.todayCount} sales`} accent />
        <Stat label="Last 7 days" value={formatRupees(s.weekSales)} />
        <Stat label="Collected today" value={formatRupees(s.todayCollected)} />
        <Stat
          label="Owed to you"
          value={formatRupees(s.outstanding)}
          sub="on credit"
          warn={s.outstanding > 0}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Payment split */}
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-sm font-medium text-ink">
            How you got paid · last 7 days
          </h2>
          {s.methodSplit.length === 0 ? (
            <p className="mt-4 text-sm text-ink-soft">No payments yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {s.methodSplit.map((m) => {
                const pct = methodTotal > 0 ? (m.amount / methodTotal) * 100 : 0;
                return (
                  <li key={m.method}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-ink">{methodLabel(m.method)}</span>
                      <span className="tabular-nums text-ink-soft">
                        {formatRupees(m.amount)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-brand-100">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Top products */}
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-sm font-medium text-ink">
            Best sellers · last 7 days
          </h2>
          {s.topProducts.length === 0 ? (
            <p className="mt-4 text-sm text-ink-soft">No sales yet.</p>
          ) : (
            <ol className="mt-4 space-y-2">
              {s.topProducts.map((p, i) => (
                <li
                  key={p.name}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="flex items-center gap-2 text-ink">
                    <span className="flex size-5 items-center justify-center rounded-full bg-brand-100 text-xs font-medium text-brand-700">
                      {i + 1}
                    </span>
                    {p.name}
                  </span>
                  <span className="tabular-nums text-ink-soft">
                    {formatRupees(p.revenue)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* Low stock */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink">Running low</h2>
          <Link
            href="/dashboard/stock"
            className="text-sm text-brand-700 hover:underline"
          >
            Manage stock →
          </Link>
        </div>
        {s.lowStock.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">
            Everything&apos;s well stocked.
          </p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2">
            {s.lowStock.map((p) => (
              <li
                key={p.name}
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-900"
              >
                {p.name} · {p.qty}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent = false,
  warn = false,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        accent
          ? "border-brand-200 bg-brand-50/60"
          : "border-line bg-surface"
      }`}
    >
      <p className="text-xs text-ink-soft">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold tabular-nums ${
          warn ? "text-red-600" : accent ? "text-brand-800" : "text-ink"
        }`}
      >
        {value}
      </p>
      {sub ? <p className="text-xs text-ink-soft">{sub}</p> : null}
    </div>
  );
}

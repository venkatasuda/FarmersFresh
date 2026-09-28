import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { formatRupees } from "@/lib/format";
import { getDebtors } from "@/lib/credit";

export const metadata = { title: "Credit ledger · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function CreditPage() {
  await requireSession();
  const debtors = (await getDebtors()).filter((d) => d.outstanding > 0);

  const totalOwed = debtors.reduce((s, d) => s + d.outstanding, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Credit ledger
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Who owes you, most first. This is money you&apos;ve earned and
          haven&apos;t collected.
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-brand-50/60 p-5">
        <p className="text-sm text-brand-800">Total outstanding</p>
        <p className="mt-1 text-3xl font-semibold text-brand-900">
          {formatRupees(totalOwed)}
        </p>
        <p className="mt-1 text-sm text-brand-800">
          across {debtors.length}{" "}
          {debtors.length === 1 ? "customer" : "customers"}
        </p>
      </div>

      {debtors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-14 text-center">
          <h2 className="text-lg font-medium text-ink">Nobody owes you</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
            Every account is settled. Credit sales at the counter will show up
            here.
          </p>
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
          <ul className="divide-y divide-line">
            {debtors.map((d) => (
              <li key={d.customerId}>
                <Link
                  href={`/dashboard/credit/${d.customerId}`}
                  className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-brand-50/50"
                >
                  <div>
                    <p className="font-medium text-ink">{d.name}</p>
                    {d.phone ? (
                      <p className="text-xs text-ink-soft">{d.phone}</p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-ink tabular-nums">
                      {formatRupees(d.outstanding)}
                    </p>
                    <p className="text-xs text-ink-soft">
                      paid {formatRupees(d.totalPaid)} of{" "}
                      {formatRupees(d.totalBilled)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

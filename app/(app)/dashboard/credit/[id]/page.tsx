import Link from "next/link";
import { notFound } from "next/navigation";
import { CollectForm } from "../collect-form";
import { requireSession } from "@/lib/auth";
import { formatRupees } from "@/lib/format";
import { getCustomerBalance, getCustomerLedger } from "@/lib/credit";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const c = await getCustomerBalance(id);
  return { title: c ? `${c.name} · Farmers Fresh` : "Not found" };
}

export default async function CustomerCreditPage({ params }: Props) {
  await requireSession();
  const { id } = await params;

  const [balance, ledger] = await Promise.all([
    getCustomerBalance(id),
    getCustomerLedger(id),
  ]);

  if (!balance) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <nav className="text-sm text-ink-soft">
        <Link href="/dashboard/credit" className="hover:text-brand-700">
          Credit ledger
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{balance.name}</span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {balance.name}
          </h1>
          {balance.phone ? (
            <a
              href={`tel:${balance.phone}`}
              className="text-sm text-brand-700 hover:underline"
            >
              {balance.phone}
            </a>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-xs text-ink-soft">Outstanding</p>
          <p
            className={`text-2xl font-semibold tabular-nums ${
              balance.outstanding > 0 ? "text-red-600" : "text-brand-700"
            }`}
          >
            {formatRupees(balance.outstanding)}
          </p>
        </div>
      </div>

      <CollectForm customerId={id} outstanding={balance.outstanding} />

      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <h2 className="border-b border-line px-5 py-3 text-sm font-medium text-ink">
          Account history
        </h2>
        {ledger.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-soft">
            No activity yet.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {ledger.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-4 px-5 py-2.5 text-sm"
              >
                <div>
                  <span
                    className={`font-medium ${
                      e.kind === "payment" ? "text-brand-700" : "text-ink"
                    }`}
                  >
                    {e.kind === "payment" ? "Payment" : "Purchase"}
                  </span>
                  {e.method ? (
                    <span className="ml-2 text-xs text-ink-soft capitalize">
                      {e.method.replace("_", " ")}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className={`font-medium tabular-nums ${
                      e.kind === "payment" ? "text-brand-700" : "text-ink"
                    }`}
                  >
                    {e.kind === "payment" ? "−" : "+"}
                    {formatRupees(e.amount)}
                  </span>
                  <span className="w-24 shrink-0 text-right text-xs text-ink-soft">
                    {new Date(e.at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-ink-soft">
        A purchase adds to what&apos;s owed; a payment reduces it. Both are
        permanent records — nothing here is edited or deleted.
      </p>
    </div>
  );
}

import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getOrders } from "@/lib/orders";
import { formatRupees } from "@/lib/format";

export const metadata = {
  title: "Dashboard · Farmers Fresh",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireSession();
  const openOrders = await getOrders(false);

  const farms = session.memberships.filter((m) => m.locationType === "farm");
  const stores = session.memberships.filter((m) => m.locationType === "store");
  const newOrders = openOrders.filter((o) => o.status === "placed");
  const openValue = openOrders.reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {session.fullName ? `Hello, ${session.fullName}` : "Hello"}
        </h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-ink-soft">
          {session.orgName}
          {session.isOwner ? (
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800">
              Owner
            </span>
          ) : null}
        </p>
      </div>

      {/* Orders first — this is the thing that needs acting on today. */}
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-ink">Orders waiting</h2>
            <p className="mt-1 text-sm text-ink-soft">
              {openOrders.length === 0
                ? "Nothing to pack right now."
                : `${openOrders.length} open · ${formatRupees(openValue)} to collect`}
            </p>
          </div>
          <Link
            href="/dashboard/orders"
            className="shrink-0 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Open queue
          </Link>
        </div>

        {newOrders.length > 0 ? (
          <p className="mt-4 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-900">
            {newOrders.length} new{" "}
            {newOrders.length === 1 ? "order needs" : "orders need"} confirming —
            customers are waiting on a call.
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <h2 className="text-sm font-medium text-ink">Your access</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Loaded through row-level security — you can only see what the database
          lets you see.
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Farms" value={farms.length} accent />
          <Stat label="Stores" value={stores.length} accent />
          <Stat
            label="Role"
            value={session.isOwner ? "Owner" : (session.memberships[0]?.role ?? "—")}
          />
          <Stat label="Signed in as" value={session.email ?? "—"} />
        </dl>
      </section>

      <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <h2 className="border-b border-line bg-brand-50/60 px-5 py-3 text-sm font-medium text-brand-900">
          Locations
        </h2>

        {session.memberships.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-soft">
            You have no locations yet. An owner needs to add you to a farm or
            store.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {session.memberships.map((m) => (
              <li
                key={m.locationId}
                className="flex items-center justify-between gap-4 px-5 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
                      m.locationType === "farm"
                        ? "bg-brand-100 text-brand-700"
                        : "bg-brand-600 text-white"
                    }`}
                  >
                    {m.locationType === "farm" ? "F" : "S"}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {m.locationName}
                    </p>
                    <p className="text-xs text-ink-soft">
                      {m.locationType === "farm" ? "Farm" : "Store"}
                      {m.locationCode ? ` · ${m.locationCode}` : null}
                    </p>
                  </div>
                </div>
                <span className="rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink-soft capitalize">
                  {m.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-ink-soft">
        Next up — Bit 3: the counter POS, so walk-in sales draw down the same
        stock the shop sells from.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd
        className={
          accent
            ? "mt-0.5 text-2xl font-semibold text-brand-700"
            : "mt-0.5 truncate text-sm font-medium text-ink"
        }
      >
        {value}
      </dd>
    </div>
  );
}

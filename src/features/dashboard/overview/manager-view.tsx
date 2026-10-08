import Link from "next/link";
import type { ManagerDashboard } from "@/lib/contracts/staff-access";
export function ManagerView({ data, location }: { data: ManagerDashboard; location: string | null }) {
  return <div className="space-y-6">
    <h1 className="text-2xl font-semibold text-ink">Store operations</h1>
    <form className="flex flex-wrap items-center gap-3"><label className="text-sm text-ink-soft">Store<select name="location" defaultValue={location ?? ""} className="ml-2 rounded-lg border border-line bg-surface p-2 text-ink"><option value="">All permitted stores</option>{data.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label><button className="rounded-lg bg-brand-600 px-4 py-2 text-white">Refresh operations</button></form>
    <p className="text-sm text-ink-soft">Orders older than 30 minutes are flagged for review. Low stock means five units or fewer; expiry covers the next seven days. Cash variance covers closed tills from the last seven days.</p>
    {data.stores.map(s => <section key={s.id} className="rounded-xl border border-line bg-surface p-4">
      <h2 className="font-semibold text-ink">{s.name}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[{label:"Overdue orders",count:s.overdue,href:"/dashboard/orders"},{label:"Open orders",count:s.open_orders,href:"/dashboard/orders"},{label:"Failed deliveries",count:s.failed_deliveries,href:"/dashboard/deliveries"},{label:"COD awaiting collection",count:s.uncollected_cod,href:`/dashboard/cash?location=${s.id}`},{label:"Low stock products",count:s.low_stock,href:`/dashboard/stock?location=${s.id}`},{label:"Expiring batches",count:s.expiring_batches,href:`/dashboard/expiry?location=${s.id}`},{label:"Till variances",count:s.cash_variances,href:`/dashboard/cash?location=${s.id}`}].map(metric => <Link key={metric.label} href={metric.href} className="rounded-lg border border-line p-3 hover:border-brand-600"><p className="text-sm text-ink-soft">{metric.label}</p><p className="mt-1 text-2xl font-semibold text-ink">{metric.count}</p></Link>)}
      </div>
    </section>)}
    <section className="rounded-xl border border-line bg-surface p-4"><h2 className="font-semibold text-ink">Store activity · latest 50 events</h2>{data.audit.length ? <ul className="mt-3 divide-y divide-line">{data.audit.map(a => <li key={a.id} className="py-2 text-sm text-ink">{new Date(a.created_at).toLocaleString("en-IN")} · {data.locations.find(l => l.id === a.location_id)?.name} · {a.event_type.replaceAll("."," ").replaceAll("_"," ")}</li>)}</ul> : <p className="mt-3 text-sm text-ink-soft">No recorded store activity.</p>}</section>
  </div>;
}

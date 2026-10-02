"use client";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Activity, RefreshCw } from "lucide-react";
import { Button, Card, Kpi, PageHeader } from "@/components/ui/dashboard";
import type { MonitoringCounts } from "@/lib/contracts/monitoring";

export function MonitoringView({ counts, scope, checkedAt }: { counts: MonitoringCounts | null; scope: string; checkedAt: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const timer = window.setInterval(() => { if (!document.hidden) router.refresh(); }, 30000);
    return () => window.clearInterval(timer);
  }, [router]);
  const cards = counts ? [
    ["Delayed orders", counts.ff_stuck_orders, "Open for more than 24 hours"],
    ["Unpaid orders", counts.ff_stale_unpaid_orders, "Awaiting payment for more than 45 minutes"],
    ["Refunds pending", counts.ff_pending_refunds, "Review before closing the order"],
    ["Payment discrepancies", counts.ff_payment_exceptions_24h, "Recorded in the last 24 hours"],
    ["Failed notifications", counts.ff_failed_notifications_24h, "Provider failures in the last 24 hours"],
    ["Skipped notifications", counts.ff_skipped_notifications_24h, "Missing providers in the last 24 hours"],
    ["Stalled notifications", counts.ff_stuck_notifications, "Pending over 15 min or sending over 5 min"],
    ["Low-stock product/store pairs", counts.ff_low_stock_products, "Published items with 5 or fewer units available"],
  ] as const : [];
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <PageHeader title="Monitoring" subtitle={`Business alerts for ${scope}. Updates every 30 seconds while this tab is visible.`} />
      <Button variant="ghost" disabled={pending} onClick={() => startTransition(() => router.refresh())}><RefreshCw aria-hidden="true" className="mr-2 size-4" />Refresh</Button>
    </div>
    <Card className="p-4">
      <p role="status" className={`flex items-center gap-2 font-medium ${counts ? "text-brand-700" : "text-amber-700"}`}><Activity aria-hidden="true" className="size-5" />{counts ? "Portal and database responding" : "Monitoring data unavailable"}</p>
      <p className="mt-1 text-sm text-ink-soft">{counts ? `Last checked ${new Date(checkedAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST. Continuous website uptime is monitored separately.` : "Counts could not be loaded. Try refreshing; unavailable data does not mean there are no issues."}</p>
    </Card>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, value, hint]) => <Kpi key={label} label={label} value={String(value)} hint={hint} tone={value > 0 ? "amber" : "brand"} />)}</div>
    <Card className="space-y-3 p-5">
      <h2 className="font-semibold text-ink">Review and resolve</h2>
      <p className="text-sm text-ink-soft">Check delayed orders, payments and refunds in Orders; review low stock in Stock. Managers see counts only for their managed stores. Notifications or payments without a matching store order are visible only to owners.</p>
      <div className="flex gap-4 text-sm text-brand-700"><Link href="/dashboard/orders" className="hover:underline">Open orders</Link><Link href="/dashboard/stock" className="hover:underline">Open stock</Link></div>
      <p className="text-xs text-ink-soft">Email alerts and continuous uptime checks run separately. Opening this portal does not start the monitoring server.</p>
    </Card>
  </div>;
}

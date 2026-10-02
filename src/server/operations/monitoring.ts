import "server-only";
import { notFound } from "next/navigation";
import { requireSession } from "@/server/auth/session";
import { createClient } from "@/server/supabase/server";
import { monitoringMetrics, type MonitoringCounts } from "@/lib/contracts/monitoring";

export async function getPortalMonitoring() {
  const session = await requireSession();
  if (!session.isOwner && !session.memberships.some(m => m.role === "manager" && m.locationType === "store")) notFound();
  let counts: MonitoringCounts | null = null;
  let denied = false;
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("portal_operations_metrics").abortSignal(AbortSignal.timeout(5000));
    denied = error?.code === "42501";
    if (!error && Array.isArray(data) && data.length === monitoringMetrics.length) {
      const values = Object.fromEntries(data.map((row: { metric: string; value: unknown }) => [row.metric, Number(row.value)]));
      if (monitoringMetrics.every(key => Number.isSafeInteger(values[key]) && values[key] >= 0)) counts = values as MonitoringCounts;
    }
  } catch { /* Show unavailable rather than leaking a database/provider error. */ }
  if (denied) notFound();
  return { counts, scope: session.isOwner ? session.orgName : session.memberships.filter(m => m.role === "manager" && m.locationType === "store").map(m => m.locationName).join(", "), checkedAt: new Date().toISOString() };
}

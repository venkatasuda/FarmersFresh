import { MonitoringView } from "@/features/dashboard/monitoring/monitoring-view";
import { getPortalMonitoring } from "@/server/operations/monitoring";
export const metadata = { title: "Monitoring · Farmers Fresh" };
export const dynamic = "force-dynamic";
export default async function MonitoringPage() {
  return <MonitoringView {...await getPortalMonitoring()} />;
}

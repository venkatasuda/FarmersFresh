import { notFound } from "next/navigation";
import { requireSession } from "@/server/auth/session";
import { getManagerDashboard } from "@/server/reporting/overview";
import { ManagerView } from "@/features/dashboard/overview/manager-view";
export const metadata = { title: "Store operations · Farmers Fresh" };
export const dynamic = "force-dynamic";
export default async function OperationsPage({ searchParams }: { searchParams: Promise<{ location?: string }> }) {
  const session=await requireSession();
  if (!session.isOwner && !session.memberships.some(m => m.role === "manager" && m.locationType === "store")) notFound();
  const requested=(await searchParams).location || null;
  const allowed=await getManagerDashboard(null);
  if (requested && !allowed.locations.some(l => l.id === requested)) notFound();
  return <ManagerView data={requested ? await getManagerDashboard(requested) : allowed} location={requested} />;
}

import { getTickets } from "@/server/customers/staff-support";
import { SupportPageView } from "@/features/dashboard/support/support-view";
import { requireSession } from "@/server/auth/session";

export const metadata = { title: "Support · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  await requireSession();
  const { all } = await searchParams;
  const showAll = all === "1";
  const rows = await getTickets(showAll);
  const open = rows.filter((r) => r.status === "open").length;

  return <SupportPageView showAll={showAll} open={open} rows={rows} />;
}

import { redirect } from "next/navigation";
import { requireSession } from "@/server/auth/session";
import { getCashLocations, getCashSummary, getCashShifts, isBusinessDate } from "@/server/reporting/staff-cash";
import { CashView } from "@/features/dashboard/cash/cash-view";

export const metadata = { title: "Cash reconciliation · Farmers Fresh" };
export const dynamic = "force-dynamic";
export default async function CashPage({ searchParams }: { searchParams: Promise<{ location?: string; date?: string }> }) {
  await requireSession();
  const locations = await getCashLocations();
  if (!locations.length) redirect("/dashboard");
  const requested = await searchParams;
  const selected = locations.find(l => l.id === requested.location) ?? locations[0];
  const location = selected.id;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const date = isBusinessDate(requested.date) && requested.date <= today ? requested.date : today;
  const summary = await getCashSummary(location, date);
  const shifts = selected.can_close ? await getCashShifts(location) : null;
  return <CashView key={`${location}:${date}`} locations={locations} location={location} date={date} today={today} summary={summary} shifts={shifts} canClose={selected.can_close} canCollect={selected.can_collect} />;
}

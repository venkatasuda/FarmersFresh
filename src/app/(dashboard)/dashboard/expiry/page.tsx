import { getExpiring } from "@/server/inventory/staff-expiry";
import { ExpiryClient } from "@/features/dashboard/expiry/expiry-client";
import { requireSession } from "@/server/auth/session";
import { redirect } from "next/navigation";

export const metadata = { title: "Expiry · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function ExpiryPage() {
  const session = await requireSession();
  if (!session.isOwner) redirect("/dashboard");

  const initial = await getExpiring(7);
  return <ExpiryClient initial={initial} initialDays={7} />;
}

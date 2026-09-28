import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getExpiring } from "./actions";
import { ExpiryClient } from "./expiry-client";

export const metadata = { title: "Expiry · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function ExpiryPage() {
  const session = await requireSession();
  if (!session.isOwner) redirect("/dashboard");

  const initial = await getExpiring(7);
  return <ExpiryClient initial={initial} initialDays={7} />;
}

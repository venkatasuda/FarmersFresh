import { getExpiring } from "@/server/inventory/staff-expiry";
import { ExpiryClient } from "@/features/dashboard/expiry/expiry-client";
import { requireSession } from "@/server/auth/session";
import { redirect } from "next/navigation";
import { getOperationalLocations } from "@/server/auth/permissions";
import { StoreSelector } from "@/features/dashboard/navigation/store-selector";

export const metadata = { title: "Expiry · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function ExpiryPage({ searchParams }: { searchParams: Promise<{location?:string}> }) {
  const session = await requireSession();
  const locations=await getOperationalLocations("inventory.adjust");
  if (!locations.length) redirect("/dashboard");
  const requested=(await searchParams).location;
  const locationId=locations.find(l=>l.id===requested)?.id ?? locations[0].id;

  const initial = await getExpiring(7, locationId);
  return <><StoreSelector locations={locations} locationId={locationId} /><ExpiryClient key={locationId} initial={initial} initialDays={7} locationId={locationId} canMarkDown={session.isOwner} /></>;
}

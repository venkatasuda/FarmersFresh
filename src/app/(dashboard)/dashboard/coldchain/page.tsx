import { getColdChain } from "@/server/inventory/staff-coldchain";
import { ColdChainClient } from "@/features/dashboard/coldchain/coldchain-client";
import { requireSession } from "@/server/auth/session";
import { getStorefrontLocationId } from "@/server/inventory/queries";
import { redirect } from "next/navigation";

export const metadata = { title: "Cold chain · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function ColdChainPage() {
  const session = await requireSession();
  if (!session.isOwner) redirect("/dashboard");

  const [data, locationId] = await Promise.all([
    getColdChain(7),
    getStorefrontLocationId(),
  ]);

  return <ColdChainClient initial={data} locationId={locationId} />;
}

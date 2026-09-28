import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getStorefrontLocationId } from "@/lib/stock";
import { getColdChain } from "./actions";
import { ColdChainClient } from "./coldchain-client";

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

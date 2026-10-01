import { DeliveryPageView } from "@/features/dashboard/delivery/delivery-view";
import { requireSession } from "@/server/auth/session";
import { getDeliveryConfiguration } from "@/server/delivery/queries";

export const metadata = { title: "Delivery & alerts · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function DeliveryPage() {
  const session = await requireSession();

  if (!session.isOwner) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-14 text-center">
        <h1 className="text-lg font-medium text-ink">Owners only</h1>
      </div>
    );
  }

  const { zoneRows, org } = await getDeliveryConfiguration(session.orgId);

  const zones = ((zoneRows ?? []) as {
    id: string;
    pincode: string;
    area_name: string | null;
  }[]).map((z) => ({
    id: z.id,
    pincode: z.pincode,
    areaName: z.area_name,
  }));

  return <DeliveryPageView zones={zones} org={org} />;
}

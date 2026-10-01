import { DeliveriesPageView } from "@/features/dashboard/deliveries/deliveries-view";
import { requireSession } from "@/server/auth/session";
import { getDeliveries, getMyProfileId, getMyShift } from "@/server/delivery/queries";

export const metadata = { title: "Deliveries · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function DeliveriesPage() {
  await requireSession();
  const [deliveries, myId, onShift] = await Promise.all([
    getDeliveries(),
    getMyProfileId(),
    getMyShift(),
  ]);

  const mine = deliveries.filter((d) => d.assignedTo === myId);
  const unclaimed = deliveries.filter((d) => !d.assignedTo);
  const others = deliveries.filter(
    (d) => d.assignedTo && d.assignedTo !== myId
  );

  return <DeliveriesPageView onShift={onShift} deliveries={deliveries} mine={mine} myId={myId} unclaimed={unclaimed} others={others} />;
}

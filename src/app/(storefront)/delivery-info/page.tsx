import { DeliveryInfoPageView } from "@/features/content/delivery-info-view";
import { getServedAreas } from "@/server/delivery/queries";

export const metadata = { title: "Delivery · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function DeliveryInfoPage() {
  // Pull the real served areas so this page can never contradict what
  // checkout actually accepts.
  const areas = await getServedAreas();

  return <DeliveryInfoPageView areas={areas} />;
}

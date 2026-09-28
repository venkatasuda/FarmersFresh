import { ShopShell } from "@/app/(shop)/shop-shell";
import { TrackClient } from "./track-client";

export const metadata = { title: "Track your order · Farmers Fresh" };

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ number?: string }>;
}) {
  // Prefill the order number when a customer arrives from the confirmation
  // page's "track this order" link.
  const { number } = await searchParams;
  return (
    <ShopShell>
      <TrackClient initialNumber={number} />
    </ShopShell>
  );
}

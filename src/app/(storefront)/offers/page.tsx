import { OffersPageView } from "@/features/offers/offers-view";
import { getOffers, getPersonalOffers } from "@/server/catalogue/storefront";

export const metadata = {
  title: "This week's deals · Farmers Fresh",
  description: "Fresh markdowns across the store — biggest savings first.",
};
export const dynamic = "force-dynamic";

export default async function OffersPage() {
  const [offers, personal] = await Promise.all([
    getOffers(),
    getPersonalOffers(),
  ]);

  const featured = offers[0] ?? null;
  const rest = featured ? offers.slice(1) : offers;

  return <OffersPageView offers={offers} featured={featured} personal={personal} rest={rest} />;
}

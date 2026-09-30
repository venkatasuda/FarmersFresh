import { AccountPageView } from "@/features/account/account-view";
import { getMyCoupons } from "@/server/loyalty/account-coupon";
import { getMyScratchCards } from "@/server/loyalty/account-scratch";
import { getMySavings, getMyWallet } from "@/server/loyalty/account-wallet";
import { getMyMembership } from "@/server/subscriptions/pass";
import { type OrderStatus } from "@/lib/types";
import { getStoreSettings } from "@/server/settings/queries";
import { getCurrentUser, getMyOrders, getMyTier } from "@/server/customers/queries";
import { redirect } from "next/navigation";

export const metadata = { title: "My account · Farmers Fresh" };
export const dynamic = "force-dynamic";

type MyOrder = {
  order_number: string;
  status: OrderStatus;
  total: number;
  placed_at: string;
  item_count: number;
  items: string | null;
};

export default async function AccountPage() {
  const user = await getCurrentUser();

  // Not logged in → the customer login (not the staff one).
  if (!user) redirect("/account/login");

  const [
    { data },
    wallet,
    membership,
    scratchCards,
    myCoupons,
    { data: tierData },
    savings,
    settings,
  ] = await Promise.all([
    getMyOrders(),
    getMyWallet(),
    getMyMembership(),
    getMyScratchCards(),
    getMyCoupons(),
    getMyTier(),
    getMySavings(),
    getStoreSettings(),
  ]);
  const tier = tierData as
    | { tier: string; spent: number; multiplier: number; next_tier: string | null; to_next: number }
    | null;
  const orders = ((data ?? []) as unknown[]).map((o) => o as MyOrder);

  const who =
    (user.user_metadata?.full_name as string | undefined) ||
    user.email ||
    (user.phone ? `+${user.phone}` : "");

  return <AccountPageView who={who} wallet={wallet} savings={savings} settings={settings} scratchCards={scratchCards} myCoupons={myCoupons} membership={membership} tier={tier} orders={orders} />;
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { ShopShell } from "@/app/(shop)/shop-shell";
import { signOutCustomer } from "./actions";
import { AddressBook } from "./address-book";
import { BuyAgain } from "./buy-again";
import { getMyWallet } from "./wallet-actions";
import { getMyMembership } from "@/app/pass/actions";
import { getMyScratchCards } from "./scratch-actions";
import { ScratchCards } from "./scratch-cards";
import { getMyCoupons } from "./coupon-actions";
import { MyCoupons } from "./my-coupons";
import { NotificationToggle } from "./notification-toggle";
import { ReportIssue } from "./report-issue";
import { Subscriptions } from "./subscriptions";
import { WalletCard } from "./wallet-card";
import { qrSvg } from "@/lib/qr";
import { createClient } from "@/lib/supabase/server";
import { formatRupees } from "@/lib/format";
import { STATUS_LABELS, type OrderStatus } from "@/lib/types";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not logged in → the customer login (not the staff one).
  if (!user) redirect("/account/login");

  const [{ data }, wallet, membership, scratchCards, myCoupons] = await Promise.all([
    supabase.rpc("my_orders"),
    getMyWallet(),
    getMyMembership(),
    getMyScratchCards(),
    getMyCoupons(),
  ]);
  const orders = ((data ?? []) as unknown[]).map((o) => o as MyOrder);

  const who =
    (user.user_metadata?.full_name as string | undefined) ||
    user.email ||
    (user.phone ? `+${user.phone}` : "");

  return (
    <ShopShell>
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              My account
            </h1>
            {who ? <p className="mt-1 text-sm text-ink-soft">{who}</p> : null}
          </div>
          <form action={signOutCustomer}>
            <button
              type="submit"
              className="rounded-lg border border-line px-3.5 py-2 text-sm text-ink-soft hover:border-brand-300 hover:text-brand-700"
            >
              Log out
            </button>
          </form>
        </div>

        {wallet ? (
          <div className="mt-6">
            <WalletCard wallet={wallet} qrSvg={await qrSvg(wallet.code)} />
          </div>
        ) : null}

        {scratchCards.length > 0 ? <ScratchCards initial={scratchCards} /> : null}

        <MyCoupons coupons={myCoupons} />

        <Link
          href="/pass"
          className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 transition-colors hover:bg-brand-100"
        >
          <div>
            <p className="text-sm font-medium text-brand-900">Farmers Fresh Pass</p>
            <p className="text-xs text-brand-700">
              {membership
                ? `Active until ${new Date(membership.expiresAt).toLocaleDateString("en-IN", { dateStyle: "medium" })} · free delivery + ${membership.discountPercent}% off`
                : "Free delivery on every order + a member discount"}
            </p>
          </div>
          <span className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white">
            {membership ? "Member" : "Get the Pass"}
          </span>
        </Link>

        <NotificationToggle />

        <BuyAgain />

        <Subscriptions />

        <AddressBook />

        <section className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
            <span className="h-5 w-1 rounded-full bg-brand-500" />
            Your orders
          </h2>

          {orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
              <p className="text-ink">No orders yet</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-ink-soft">
                Orders you place with this number will appear here.
              </p>
              <Link
                href="/"
                className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                Start shopping
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {orders.map((o) => (
                <li
                  key={o.order_number}
                  className="rounded-2xl border border-line bg-surface p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink">{o.order_number}</p>
                      <p className="text-xs text-ink-soft">
                        {new Date(o.placed_at).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                    <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-800">
                      {STATUS_LABELS[o.status] ?? o.status}
                    </span>
                  </div>
                  {o.items ? (
                    <p className="mt-2 line-clamp-1 text-sm text-ink-soft">
                      {o.items}
                    </p>
                  ) : null}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-ink tabular-nums">
                      {formatRupees(o.total)}
                    </span>
                    <span className="flex items-center gap-3">
                      <Link
                        href={`/receipt?number=${encodeURIComponent(o.order_number)}`}
                        className="text-sm text-ink-soft hover:text-brand-700 hover:underline"
                      >
                        Receipt
                      </Link>
                      <Link
                        href={`/track?number=${encodeURIComponent(o.order_number)}`}
                        className="text-sm text-brand-700 hover:underline"
                      >
                        Track →
                      </Link>
                    </span>
                  </div>
                  {o.status === "delivered" ? (
                    <ReportIssue orderNumber={o.order_number} />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </ShopShell>
  );
}

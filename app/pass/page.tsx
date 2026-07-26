import { ShopShell } from "@/app/(shop)/shop-shell";
import { getMyMembership, getPlans } from "./actions";
import { PassClient } from "./pass-client";

export const metadata = {
  title: "Farmers Fresh Pass — free delivery & member prices",
  description: "Free delivery on every order plus a member discount, all year.",
};
export const dynamic = "force-dynamic";

export default async function PassPage() {
  const [plans, membership] = await Promise.all([getPlans(), getMyMembership()]);

  return (
    <ShopShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 px-6 py-8 text-white">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-brand-50 ring-1 ring-white/15 ring-inset">
            <span className="size-1.5 rounded-full bg-brand-200" />
            Farmers Fresh Pass
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Free delivery, every order.
          </h1>
          <p className="mt-2 max-w-md text-brand-100">
            Join the Pass for unlimited free delivery and a member discount on
            everything — fresh groceries and farm meat alike.
          </p>
        </div>

        <PassClient plans={plans} membership={membership} />
      </div>
    </ShopShell>
  );
}

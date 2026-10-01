import { CouponsPageView } from "@/features/dashboard/coupons/coupons-view";
import { requireSession } from "@/server/auth/session";
import { getAdminCoupons } from "@/server/loyalty/queries";

export const metadata = { title: "Coupons · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function CouponsPage() {
  const session = await requireSession();
  if (!session.isOwner) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-14 text-center">
        <h1 className="text-lg font-medium text-ink">Owners only</h1>
      </div>
    );
  }

  const data = await getAdminCoupons();

  const coupons = (data ?? []) as {
    id: string;
    code: string;
    kind: "percent" | "flat";
    value: number;
    max_discount: number | null;
    min_subtotal: number;
    per_phone_limit: number;
    used_count: number;
    usage_limit: number | null;
    is_active: boolean;
    expires_at: string | null;
  }[];

  return <CouponsPageView coupons={coupons} />;
}

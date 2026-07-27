import { CouponForm } from "./coupon-form";
import { CouponToggle } from "./coupon-toggle";
import { GrantCoupon } from "./grant-coupon";
import { requireSession } from "@/lib/auth";
import { formatRupees } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();
  const { data } = await supabase
    .from("coupons")
    .select(
      "id, code, kind, value, max_discount, min_subtotal, per_phone_limit, used_count, usage_limit, is_active, expires_at"
    )
    .order("created_at", { ascending: false });

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Coupons
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Discount codes customers enter at checkout. Every code is validated on
          the server — the discount can&apos;t be faked from the browser.
        </p>
      </div>

      <CouponForm />

      <GrantCoupon />

      <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <h2 className="border-b border-line px-5 py-3 text-sm font-medium text-ink">
          Your codes
        </h2>
        {coupons.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-soft">
            No coupons yet.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {coupons.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div>
                  <p className="font-medium text-ink">
                    {c.code}
                    <span className="ml-2 text-sm font-normal text-ink-soft">
                      {c.kind === "percent"
                        ? `${c.value}% off${c.max_discount ? `, max ${formatRupees(c.max_discount)}` : ""}`
                        : `${formatRupees(c.value)} off`}
                    </span>
                  </p>
                  <p className="text-xs text-ink-soft">
                    {c.min_subtotal > 0
                      ? `Min ${formatRupees(c.min_subtotal)} · `
                      : ""}
                    {c.per_phone_limit} per customer · used {c.used_count}
                    {c.usage_limit ? ` / ${c.usage_limit}` : ""}
                  </p>
                </div>
                <CouponToggle id={c.id} active={c.is_active} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

import { InfoPage } from "@/app/(shop)/info-layout";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Delivery · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function DeliveryInfoPage() {
  // Pull the real served areas so this page can never contradict what
  // checkout actually accepts.
  const supabase = await createClient();
  const { data } = await supabase.rpc("served_areas");
  const areas = (data ?? []) as { pincode: string; area_name: string | null }[];

  return (
    <InfoPage title="Delivery">
      <p>
        We deliver fresh, cut-to-order meat and everyday groceries from our own
        farms and kitchen. Everything is packed the day it goes out.
      </p>

      <h2>Charges</h2>
      <p>
        Delivery is <strong>free on orders over ₹500</strong>. Below that, a
        flat <strong>₹40</strong> applies. You&apos;ll see the exact amount
        before you place the order.
      </p>

      <h2>Timing</h2>
      <p>
        Choose a slot at checkout — same-day evening, or next morning. We call
        to confirm before we set out. Fresh cuts are weighed at packing, so the
        final total follows the scale; we confirm any difference on that call.
      </p>

      <h2>Payment</h2>
      <p>
        Pay when your order reaches you — <strong>cash or UPI</strong>. Please
        keep the amount ready for the delivery.
      </p>

      <h2>Where we deliver</h2>
      {areas.length > 0 ? (
        <>
          <p>We currently deliver to these areas:</p>
          <ul className="!mt-2 list-disc space-y-1 pl-5">
            {areas.map((a) => (
              <li key={a.pincode}>
                {a.area_name ? `${a.area_name} — ` : ""}
                {a.pincode}
              </li>
            ))}
          </ul>
          <p className="!mt-3">
            We&apos;re adding new areas often. If your PIN code isn&apos;t here
            yet, check back soon.
          </p>
        </>
      ) : (
        <p>
          Enter your PIN code at checkout and we&apos;ll tell you right away
          whether we reach you.
        </p>
      )}
    </InfoPage>
  );
}

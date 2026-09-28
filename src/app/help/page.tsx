import { ShopShell } from "@/app/(shop)/shop-shell";
import { getStoreSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { HelpForm } from "./help-form";

export const metadata = { title: "Help & support · Farmers Fresh" };
export const dynamic = "force-dynamic";

const FAQ = [
  {
    q: "How do I track my order?",
    a: "Open ‘Track’ from the top of the page and enter your order number and the mobile number you ordered with. Once it's out for delivery you'll see your rider on a live map.",
  },
  {
    q: "What payment options are there?",
    a: "Pay cash on delivery, or pay online now with UPI or card. Online payments are confirmed before we start your order.",
  },
  {
    q: "How do loyalty points work?",
    a: "You earn 1 point for every ₹100 spent, and 1 point is worth ₹1 off. Redeem them at checkout or show your loyalty QR at the counter.",
  },
  {
    q: "Something was wrong with my order.",
    a: "Open your account, find the delivered order, and tap ‘Report an issue’. We'll review it and refund to your points if it's approved.",
  },
  {
    q: "Can I get free delivery?",
    a: "Yes — orders over the free-delivery threshold ship free, and Farmers Fresh Pass members get free delivery on every order.",
  },
];

export default async function HelpPage() {
  const supabase = await createClient();
  const [{ data: { user } }, settings] = await Promise.all([
    supabase.auth.getUser(),
    getStoreSettings(),
  ]);

  return (
    <ShopShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Help &amp; support
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Answers to common questions — and a direct line to us.
          </p>
        </div>

        {settings.supportPhone || settings.supportEmail ? (
          <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
            Reach us
            {settings.supportPhone ? (
              <>
                {" "}
                on{" "}
                <a href={`tel:${settings.supportPhone}`} className="font-medium underline">
                  {settings.supportPhone}
                </a>
              </>
            ) : null}
            {settings.supportEmail ? (
              <>
                {settings.supportPhone ? " or " : " at "}
                <a href={`mailto:${settings.supportEmail}`} className="font-medium underline">
                  {settings.supportEmail}
                </a>
              </>
            ) : null}
            .
          </div>
        ) : null}

        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-sm font-medium text-ink">Common questions</h2>
          <dl className="mt-3 divide-y divide-line">
            {FAQ.map((f) => (
              <div key={f.q} className="py-3">
                <dt className="text-sm font-medium text-ink">{f.q}</dt>
                <dd className="mt-1 text-sm text-ink-soft">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <HelpForm loggedIn={!!user} />
      </div>
    </ShopShell>
  );
}

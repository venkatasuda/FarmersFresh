import { InfoPage } from "@/app/(shop)/info-layout";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Contact · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function ContactPage() {
  // Show the shop's real alert phone if one is set, so the contact number
  // matches where the business actually answers.
  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("notify_phone, notify_email")
    .not("notify_phone", "is", null)
    .maybeSingle();

  const phone = (org as { notify_phone: string | null } | null)?.notify_phone;
  const email = (org as { notify_email: string | null } | null)?.notify_email;

  return (
    <InfoPage title="Contact us">
      <p>
        Questions about an order, a cut, or delivery? We&apos;re happy to help.
      </p>

      <h2>Call or WhatsApp</h2>
      {phone ? (
        <p>
          <a href={`tel:${phone}`}>
            <strong>{phone}</strong>
          </a>
          <br />
          Best for anything about a live order — have your order number ready.
        </p>
      ) : (
        <p>Our shop number will appear here once it&apos;s set.</p>
      )}

      <h2>Email</h2>
      {email ? (
        <p>
          <a href={`mailto:${email}`}>{email}</a>
        </p>
      ) : (
        <p>Reach us through the number above for now.</p>
      )}

      <h2>Hours</h2>
      <p>
        We take orders on the website any time. Deliveries and calls are handled
        during shop hours — roughly 7 am to 8 pm, every day.
      </p>
    </InfoPage>
  );
}

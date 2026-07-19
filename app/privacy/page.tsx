import { InfoPage } from "@/app/(shop)/info-layout";

export const metadata = { title: "Privacy · Farmers Fresh" };

export default function PrivacyPage() {
  return (
    <InfoPage title="Privacy">
      <p>
        We keep this simple. We only collect what we need to bring you your
        order, and we don&apos;t sell your information to anyone.
      </p>

      <h2>What we collect</h2>
      <p>
        When you place an order, we take your <strong>name, phone number and
        delivery address</strong>. That&apos;s it. We use it to prepare, deliver
        and follow up on your order, and to reach you if there&apos;s a problem.
      </p>

      <h2>What we don&apos;t do</h2>
      <p>
        We don&apos;t store card or bank details — you pay cash or UPI at the
        door, so that information never reaches us. We don&apos;t sell or rent
        your details to advertisers or other businesses.
      </p>

      <h2>Who can see it</h2>
      <p>
        Only our own staff, and only what they need to fulfil your order. Our
        systems are protected so your details aren&apos;t visible to other
        customers or the public.
      </p>

      <h2>Your choices</h2>
      <p>
        Want your details removed after an order is complete? Just ask us on the
        contact number and we&apos;ll take care of it.
      </p>
    </InfoPage>
  );
}

import { InfoPage } from "@/app/(shop)/info-layout";

export const metadata = { title: "Returns & refunds · Farmers Fresh" };

export default function ReturnsPage() {
  return (
    <InfoPage title="Returns & refunds">
      <p>
        We sell fresh meat and food, so we can&apos;t take items back once
        they&apos;re delivered — but if something is wrong, we make it right.
      </p>

      <h2>Check at the door</h2>
      <p>
        Because you pay on delivery, please look over your order{" "}
        <strong>before you pay</strong>. If a cut isn&apos;t right, the weight
        looks off, or anything is missing, tell our delivery person there and
        then. They can adjust the order or the amount on the spot.
      </p>

      <h2>If there&apos;s a problem after delivery</h2>
      <p>
        Call or WhatsApp us the <strong>same day</strong> with your order number
        and a photo if you can. For a genuine quality issue we&apos;ll replace
        the item on your next delivery or refund it — your choice.
      </p>

      <h2>Refunds</h2>
      <p>
        Since orders are paid on delivery, refunds are given as{" "}
        <strong>cash or UPI back</strong>, or as credit against your next order,
        usually within 2–3 days of us confirming the issue.
      </p>

      <h2>Cancelling</h2>
      <p>
        You can cancel any time before we set out for delivery — just call us.
        Once an order is out for delivery it can&apos;t be cancelled, but you
        can always decline it at the door.
      </p>
    </InfoPage>
  );
}

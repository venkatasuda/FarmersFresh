import { InfoPage } from "@/app/(shop)/info-layout";

export const metadata = {
  title: "Terms & Conditions · Farmers Fresh",
  description: "The terms for ordering groceries and fresh meat from Farmers Fresh.",
};

export default function TermsPage() {
  return (
    <InfoPage title="Terms & Conditions">
      <p>
        By ordering from Farmers Fresh you agree to these terms. We&apos;ve kept
        them plain.
      </p>

      <h2>Ordering</h2>
      <p>
        Placing an order is an offer to buy. We confirm it by phone before
        delivery. We may decline or cancel an order if an item is out of stock,
        the delivery address is outside our area, or we can&apos;t reach you.
      </p>

      <h2>Prices &amp; weights</h2>
      <p>
        Prices are shown per pack or per kg and include what you see — no hidden
        handling or surge fees. Fresh meat is cut to order and weighed at
        packing, so the final price follows the actual weight; we&apos;ll confirm
        it with you. All prices are in Indian Rupees.
      </p>

      <h2>Payment</h2>
      <p>
        You can pay cash or UPI on delivery, or online at checkout. Online
        payments are processed by our payment partner; we never see or store your
        card details.
      </p>

      <h2>Delivery</h2>
      <p>
        We deliver to the areas listed at checkout, in the slot you choose, as
        stock and conditions allow. Someone should be available at the address to
        receive the order.
      </p>

      <h2>Returns &amp; refunds</h2>
      <p>
        If something isn&apos;t right — quality, weight or a missing item — tell us
        at delivery or call us the same day and we&apos;ll make it right. See our{" "}
        <a href="/returns">Returns &amp; refunds</a> page for details.
      </p>

      <h2>Your account</h2>
      <p>
        Keep your login details private. You&apos;re responsible for orders placed
        from your account. Loyalty points and coupons have no cash value and may
        expire or change.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? Reach us through the{" "}
        <a href="/contact">contact</a> page.
      </p>
    </InfoPage>
  );
}

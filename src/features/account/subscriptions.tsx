import { getMySubscriptions } from "./subscription-actions";
import { SubscriptionList } from "./subscription-list";

/**
 * "Subscriptions" on the account page — repeat deliveries the customer set up.
 * Server component so it renders inline; the list itself is a client island for
 * pause/resume/cancel. Renders nothing if they have none.
 */
export async function Subscriptions() {
  const subs = await getMySubscriptions();
  if (subs.length === 0) return null;

  return (
    <section className="mt-6">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
        <span className="h-5 w-1 rounded-full bg-brand-500" />
        Subscriptions
      </h2>
      <SubscriptionList initial={subs} />
    </section>
  );
}

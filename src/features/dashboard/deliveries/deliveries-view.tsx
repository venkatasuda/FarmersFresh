import { DeliveryCard } from "@/features/dashboard/deliveries/delivery-card";
import { DeliveryControls } from "@/features/dashboard/deliveries/delivery-controls";

type DeliveriesPageViewProps = {
  canReceive: boolean;
  onShift: boolean;
  deliveries: import("@/lib/types").Delivery[];
  mine: import("@/lib/types").Delivery[];
  myId: string | null;
  unclaimed: import("@/lib/types").Delivery[];
  others: import("@/lib/types").Delivery[];
};

export function DeliveriesPageView({ onShift, deliveries, mine, myId, unclaimed, others, canReceive }: DeliveriesPageViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Deliveries
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Orders ready to go out. Take one, navigate, and mark it delivered —
          the customer is told automatically.
        </p>
      </div>

      <DeliveryControls initialOnShift={onShift} />

      {deliveries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center">
          <h2 className="text-lg font-medium text-ink">Nothing to deliver</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
            Orders appear here once they&apos;re confirmed and packed.
          </p>
        </div>
      ) : (
        <>
          {mine.length > 0 ? (
            <Section title="Yours" count={mine.length}>
              {mine.map((d) => (
                <DeliveryCard key={d.id} delivery={d} myId={myId} canReceive={canReceive} />
              ))}
            </Section>
          ) : null}

          {unclaimed.length > 0 ? (
            <Section title="Ready to take" count={unclaimed.length}>
              {unclaimed.map((d) => (
                <DeliveryCard key={d.id} delivery={d} myId={myId} canReceive={canReceive} />
              ))}
            </Section>
          ) : null}

          {others.length > 0 ? (
            <Section title="With other riders" count={others.length}>
              {others.map((d) => (
                <DeliveryCard key={d.id} delivery={d} myId={myId} canReceive={canReceive} />
              ))}
            </Section>
          ) : null}
        </>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-ink-soft">
        {title} <span className="text-ink-soft/60">({count})</span>
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

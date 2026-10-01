import { DeliveryAdmin } from "@/features/dashboard/delivery/delivery-admin";

type DeliveryPageViewProps = {
  zones: { id: string; pincode: string; areaName: string | null; }[];
  org: { notify_email: string | null; notify_phone: string | null; } | null;
};

export function DeliveryPageView({ zones, org }: DeliveryPageViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Delivery & alerts
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Where you deliver, and how you hear about new orders.
        </p>
      </div>

      <DeliveryAdmin
        zones={zones}
        notifyEmail={
          (org as { notify_email: string | null } | null)?.notify_email ?? ""
        }
        notifyPhone={
          (org as { notify_phone: string | null } | null)?.notify_phone ?? ""
        }
      />
    </div>
  );
}

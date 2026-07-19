import { DeliveryAdmin } from "./delivery-admin";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Delivery & alerts · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function DeliveryPage() {
  const session = await requireSession();

  if (!session.isOwner) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-14 text-center">
        <h1 className="text-lg font-medium text-ink">Owners only</h1>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: zoneRows }, { data: org }] = await Promise.all([
    supabase
      .from("delivery_zones")
      .select("id, pincode, area_name")
      .order("pincode"),
    supabase
      .from("organizations")
      .select("notify_email, notify_phone")
      .eq("id", session.orgId)
      .maybeSingle(),
  ]);

  const zones = ((zoneRows ?? []) as {
    id: string;
    pincode: string;
    area_name: string | null;
  }[]).map((z) => ({
    id: z.id,
    pincode: z.pincode,
    areaName: z.area_name,
  }));

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

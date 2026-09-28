import { BannerAdmin } from "./banner-admin";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Banners · Farmers Fresh" };
export const dynamic = "force-dynamic";

export default async function BannersPage() {
  const session = await requireSession();
  if (!session.isOwner) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-6 py-14 text-center">
        <h1 className="text-lg font-medium text-ink">Owners only</h1>
      </div>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("banners")
    .select("id, title, subtitle, href, bg_from, bg_to, is_active")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Homepage banners
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Run campaigns on your storefront — they show in a rotating carousel at
          the top of the shop.
        </p>
      </div>

      <BannerAdmin
        banners={
          (data ?? []) as {
            id: string;
            title: string;
            subtitle: string | null;
            href: string | null;
            bg_from: string;
            bg_to: string;
            is_active: boolean;
          }[]
        }
      />
    </div>
  );
}

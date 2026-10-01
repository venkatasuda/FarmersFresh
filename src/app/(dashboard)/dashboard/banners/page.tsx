import { BannersPageView } from "@/features/dashboard/banners/banners-view";
import { requireSession } from "@/server/auth/session";
import { getAdminBanners } from "@/server/catalogue/banners";

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

  const data = await getAdminBanners();

  return <BannersPageView data={data} />;
}

import { BannerAdmin } from "@/features/dashboard/banners/banner-admin";

type BannersPageViewProps = {
  data: { id: string; title: string; subtitle: string | null; href: string | null; bg_from: string; bg_to: string; is_active: boolean; }[] | null;
};

export function BannersPageView({ data }: BannersPageViewProps) {
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

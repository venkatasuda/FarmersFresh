/** SERVER ONLY. Active promo banners for the storefront carousel. */
import { createClient } from "@/lib/supabase/server";
import type { Banner } from "@/lib/types";

export async function getActiveBanners(): Promise<Banner[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("active_banners");
  if (error) return [];
  return (
    (data ?? []) as {
      id: string;
      title: string;
      subtitle: string | null;
      cta_label: string | null;
      href: string | null;
      bg_from: string;
      bg_to: string;
      image_path: string | null;
    }[]
  ).map((b) => ({
    id: b.id,
    title: b.title,
    subtitle: b.subtitle,
    ctaLabel: b.cta_label,
    href: b.href,
    bgFrom: b.bg_from,
    bgTo: b.bg_to,
    imagePath: b.image_path,
  }));
}

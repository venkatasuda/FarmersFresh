"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sanitizeError } from "@/lib/guard";

export type BannerResult = { ok: true } | { ok: false; message: string };

export async function createBanner(input: {
  title: string;
  subtitle: string;
  ctaLabel: string;
  href: string;
  bgFrom: string;
  bgTo: string;
}): Promise<BannerResult> {
  if (!input.title.trim()) {
    return { ok: false, message: "Give the banner a title." };
  }

  const supabase = await createClient();
  const { data: orgId } = await supabase.rpc("current_org_id");
  if (!orgId) return { ok: false, message: "Not signed in." };

  const { error } = await supabase.from("banners").insert({
    org_id: orgId,
    title: input.title.trim(),
    subtitle: input.subtitle.trim() || null,
    cta_label: input.ctaLabel.trim() || null,
    href: input.href.trim() || null,
    bg_from: input.bgFrom,
    bg_to: input.bgTo,
  });

  if (error) return { ok: false, message: sanitizeError(error.message) };
  revalidatePath("/dashboard/banners");
  revalidatePath("/");
  return { ok: true };
}

export async function toggleBanner(
  id: string,
  active: boolean
): Promise<BannerResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("banners")
    .update({ is_active: active })
    .eq("id", id);
  if (error) return { ok: false, message: sanitizeError(error.message) };
  revalidatePath("/dashboard/banners");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteBanner(id: string): Promise<BannerResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("banners").delete().eq("id", id);
  if (error) return { ok: false, message: sanitizeError(error.message) };
  revalidatePath("/dashboard/banners");
  revalidatePath("/");
  return { ok: true };
}

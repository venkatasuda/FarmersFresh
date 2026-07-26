"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sanitizeError } from "@/lib/guard";

export type AdminSettings = {
  name: string;
  supportEmail: string;
  supportPhone: string;
  notifyEmail: string;
  notifyPhone: string;
  freeDeliveryThreshold: number;
  deliveryFee: number;
  gstin: string;
  businessAddress: string;
};

export async function getAdminSettings(): Promise<AdminSettings | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_store_admin_settings");
  if (!data) return null;
  const d = data as Record<string, unknown>;
  return {
    name: (d.name as string) ?? "",
    supportEmail: (d.support_email as string) ?? "",
    supportPhone: (d.support_phone as string) ?? "",
    notifyEmail: (d.notify_email as string) ?? "",
    notifyPhone: (d.notify_phone as string) ?? "",
    freeDeliveryThreshold: Number(d.free_delivery_threshold ?? 500),
    deliveryFee: Number(d.delivery_fee ?? 40),
    gstin: (d.gstin as string) ?? "",
    businessAddress: (d.business_address as string) ?? "",
  };
}

export async function saveSettings(
  input: AdminSettings
): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_store_settings", {
    p_name: input.name,
    p_support_email: input.supportEmail,
    p_support_phone: input.supportPhone,
    p_notify_email: input.notifyEmail,
    p_notify_phone: input.notifyPhone,
    p_free_delivery_threshold: Number.isFinite(input.freeDeliveryThreshold)
      ? input.freeDeliveryThreshold
      : null,
    p_delivery_fee: Number.isFinite(input.deliveryFee) ? input.deliveryFee : null,
    p_gstin: input.gstin,
    p_business_address: input.businessAddress,
  });
  if (error) return { ok: false, message: sanitizeError(error.message) };
  revalidatePath("/dashboard/settings");
  revalidatePath("/checkout");
  return { ok: true };
}

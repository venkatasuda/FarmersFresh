"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ZoneResult = { ok: true } | { ok: false; message: string };

export async function addZone(
  pincode: string,
  areaName: string
): Promise<ZoneResult> {
  const clean = pincode.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) {
    return { ok: false, message: "A PIN code is 6 digits." };
  }

  const supabase = await createClient();
  const { data: orgId } = await supabase.rpc("current_org_id");
  if (!orgId) return { ok: false, message: "Not signed in." };

  // RLS (zone_owner_write) already restricts this to owners of this org.
  const { error } = await supabase.from("delivery_zones").insert({
    org_id: orgId,
    pincode: clean,
    area_name: areaName.trim() || null,
  });

  if (error) {
    return {
      ok: false,
      message: error.message.includes("duplicate")
        ? "That PIN code is already on the list."
        : error.message,
    };
  }

  revalidatePath("/dashboard/delivery");
  return { ok: true };
}

export async function removeZone(id: string): Promise<ZoneResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("delivery_zones").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard/delivery");
  return { ok: true };
}

export async function saveNotificationTargets(
  email: string,
  phone: string
): Promise<ZoneResult> {
  const supabase = await createClient();
  const { data: orgId } = await supabase.rpc("current_org_id");
  if (!orgId) return { ok: false, message: "Not signed in." };

  const cleanPhone = phone.replace(/\s|-|\+91/g, "");
  if (phone && !/^[6-9]\d{9}$/.test(cleanPhone)) {
    return { ok: false, message: "Enter a valid 10-digit mobile, or leave it blank." };
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      notify_email: email.trim() || null,
      notify_phone: cleanPhone || null,
    })
    .eq("id", orgId);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard/delivery");
  return { ok: true };
}

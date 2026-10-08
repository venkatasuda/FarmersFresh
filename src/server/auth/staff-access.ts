import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/server/supabase/server";
import { isUuid, sanitizeError } from "@/lib/guard";
import type { StaffAccess, StaffRole } from "@/lib/contracts/staff-access";

export async function getStaffAccess(): Promise<StaffAccess> {
  const db = await createClient();
  const { data, error } = await db.rpc("staff_access_overview");
  if (error || !data) throw new Error("Staff access is temporarily unavailable.");
  return data as StaffAccess;
}
export async function setStaffAccess(user: string, location: string, role: StaffRole | null, reason: string) {
  if (!isUuid(user) || !isUuid(location) || (role !== null && !["manager", "staff", "accountant"].includes(role))) return { ok: false, message: "Choose a supported staff role." };
  if (typeof reason !== "string" || !reason.trim() || reason.length > 500) return { ok: false, message: "Give an access reason within 500 characters." };
  const db = await createClient();
  const { error } = await db.rpc("set_staff_access", { p_user: user, p_location: location, p_role: role, p_reason: reason.trim() });
  if (error) return { ok: false, message: sanitizeError(error.message) };
  revalidatePath("/dashboard", "layout"); return { ok: true };
}

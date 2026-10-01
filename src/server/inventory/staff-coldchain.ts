import "server-only";
import type { ColdChain } from "@/lib/contracts/staff-coldchain";
import { sanitizeError } from "@/lib/guard";
import { createClient } from "@/server/supabase/server";
import { revalidatePath } from "next/cache";

export async function getColdChain(days = 7): Promise<ColdChain> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("recent_temperature", { p_days: days, p_limit: 100 });
  const d = (data ?? {}) as Record<string, unknown>;
  const readings = ((d.readings ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    area: String(r.area ?? ""),
    tempC: Number(r.temp_c ?? 0),
    targetMin: r.target_min === null || r.target_min === undefined ? null : Number(r.target_min),
    targetMax: r.target_max === null || r.target_max === undefined ? null : Number(r.target_max),
    breach: Boolean(r.breach),
    note: (r.note as string | null) ?? null,
    createdAt: String(r.created_at ?? ""),
  }));
  return { breaches: Number(d.breaches ?? 0), readings };
}

export async function logTemperature(input: {
  locationId: string;
  area: string;
  tempC: number;
  min: number | null;
  max: number | null;
  note: string;
}): Promise<{ ok: true; breach: boolean } | { ok: false; message: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("log_temperature", {
    p_location: input.locationId,
    p_area: input.area,
    p_temp: input.tempC,
    p_min: input.min,
    p_max: input.max,
    p_note: input.note.trim() || null,
  });
  if (error) return { ok: false, message: sanitizeError(error.message) };
  revalidatePath("/dashboard/coldchain");
  return { ok: true, breach: Boolean(data) };
}

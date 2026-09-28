import type { SupabaseClient } from "@supabase/supabase-js";

// The immutable event log is the audit trail today and the AI dataset tomorrow.
// Call logEvent() from every action that changes money or records.
export type EventInput = {
  orgId: string;
  locationId?: string | null;
  eventType: string; // e.g. "sale.created", "payment.recorded", "customer.created"
  entityType?: string | null; // e.g. "sale", "payment", "customer"
  entityId?: string | null;
  payload?: Record<string, unknown>;
};

export async function logEvent(
  supabase: SupabaseClient,
  e: EventInput
): Promise<void> {
  const { error } = await supabase.from("events").insert({
    org_id: e.orgId,
    location_id: e.locationId ?? null,
    event_type: e.eventType,
    entity_type: e.entityType ?? null,
    entity_id: e.entityId ?? null,
    payload: e.payload ?? {},
  });

  // Never let logging break the main action; surface it for debugging.
  if (error) console.error("logEvent failed:", error.message);
}

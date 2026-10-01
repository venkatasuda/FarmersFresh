"use server";

import * as backend from "@/server/customers/staff-support";
export type { Ticket } from "@/lib/contracts/staff-support";

export async function getTickets(...args: Parameters<typeof backend.getTickets>) {
  return backend.getTickets(...args);
}

export async function resolveTicket(...args: Parameters<typeof backend.resolveTicket>) {
  return backend.resolveTicket(...args);
}

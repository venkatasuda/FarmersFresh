"use server";

import * as backend from "@/server/customers/help";

export async function createSupportTicket(...args: Parameters<typeof backend.createSupportTicket>) {
  return backend.createSupportTicket(...args);
}

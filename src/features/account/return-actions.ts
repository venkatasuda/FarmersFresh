"use server";

import * as backend from "@/server/customers/account-return";

export async function requestReturn(...args: Parameters<typeof backend.requestReturn>) {
  return backend.requestReturn(...args);
}

"use server";

import * as backend from "@/server/customers/account";

export async function signOutCustomer(...args: Parameters<typeof backend.signOutCustomer>) {
  return backend.signOutCustomer(...args);
}

"use server";

import * as backend from "@/server/delivery/shop-location";

export async function checkLocation(...args: Parameters<typeof backend.checkLocation>) {
  return backend.checkLocation(...args);
}

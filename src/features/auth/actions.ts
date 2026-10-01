"use server";

import * as backend from "@/server/auth/auth";

export async function signIn(...args: Parameters<typeof backend.signIn>) {
  return backend.signIn(...args);
}

export async function signOut(...args: Parameters<typeof backend.signOut>) {
  return backend.signOut(...args);
}

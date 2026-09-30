"use server";

import * as backend from "@/server/catalogue/reviews-review";
export type { ReviewResult } from "@/lib/contracts/reviews-review";

export async function submitReview(...args: Parameters<typeof backend.submitReview>) {
  return backend.submitReview(...args);
}

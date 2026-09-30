import { settlePaymentWebhook } from "@/server/payments/webhook";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return settlePaymentWebhook(request);
}

import { apiRequest } from "@/server/security/http";
import { verifyOrderPayment } from "@/server/payments/verify-order";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  return apiRequest(request, verifyOrderPayment, "payment-verify");
}

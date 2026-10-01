import { apiRequest } from "@/server/security/http";
import { verifyMembershipPayment } from "@/server/payments/verify-membership";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  return apiRequest(request, verifyMembershipPayment, "payment-verify");
}

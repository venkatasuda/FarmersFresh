import { apiRequest } from "@/server/security/http";
import { createMembershipPayment } from "@/server/payments/membership";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  return apiRequest(request, createMembershipPayment, "payment-create");
}

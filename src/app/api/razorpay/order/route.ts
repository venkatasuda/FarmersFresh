import { apiRequest } from "@/server/security/http";
import { createOrderPayment } from "@/server/payments/order";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  return apiRequest(request, createOrderPayment, "payment-create");
}

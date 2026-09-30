import { createOrderPayment } from "@/server/payments/order";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  return createOrderPayment(request);
}

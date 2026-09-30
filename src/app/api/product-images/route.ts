import { apiRequest } from "@/server/security/http";
import { uploadProductImage } from "@/server/catalogue/upload";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  return apiRequest(request, uploadProductImage, "image-upload");
}

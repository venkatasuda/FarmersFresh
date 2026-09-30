import { apiRequest } from "@/server/security/http";
import { searchByImage } from "@/server/catalogue/visual-search";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  return apiRequest(request, searchByImage, "visual-search");
}

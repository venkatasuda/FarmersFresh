import { searchByImage } from "@/server/catalogue/visual-search";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  return searchByImage(request);
}

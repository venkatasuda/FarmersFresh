import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 renamed `middleware.ts` to `proxy.ts` and the exported function
// from `middleware` to `proxy`. The runtime is nodejs and is not configurable.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on every path except:
     *  - _next/static, _next/image  (build output)
     *  - favicon / manifest / icons / images
     * Auth cookies must be refreshed on real page requests, so keep this broad.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

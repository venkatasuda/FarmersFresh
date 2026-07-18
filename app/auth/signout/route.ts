import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Clears the session and returns to /login, optionally with a message.
 *
 * This exists as a Route Handler rather than a Server Component because only
 * Route Handlers and Server Actions can actually write cookies. A Server
 * Component calling signOut() fails silently — which would leave a user with
 * a valid token but no profile bouncing between /login and /dashboard forever.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const url = request.nextUrl.clone();
  url.pathname = "/login";

  const error = request.nextUrl.searchParams.get("error");
  url.search = "";
  if (error) url.searchParams.set("error", error);

  return NextResponse.redirect(url);
}

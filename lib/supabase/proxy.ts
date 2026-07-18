import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * Routes that REQUIRE a session. Everything else is the public storefront.
 *
 * This is deliberately an allow-list of protected prefixes rather than a
 * deny-list of public ones: the shop is a public website, and a new marketing
 * page must not silently 302 customers to a staff login because someone
 * forgot to add it to a list.
 *
 * The safety net is that RLS, not this file, is what actually protects data.
 * If a policy is wrong, adding a path here would not save you.
 */
const PROTECTED_PREFIXES = ["/dashboard", "/staff", "/admin", "/pos"];

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

/**
 * Refreshes the Supabase auth token on every request and redirects
 * unauthenticated users to /login.
 *
 * Two rules from the Supabase SSR docs that are easy to get wrong:
 *  1. Always return the SAME response object the cookies were written on,
 *     or the refreshed session is silently dropped and the user is logged
 *     out at random.
 *  2. Call getUser() — not getSession() — here. getUser() revalidates the
 *     token with the auth server; getSession() trusts the cookie.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Signed out and asking for a protected page → send to login,
  // remembering where they were headed.
  if (!user && isProtected(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Already signed in and hitting /login → send them onward.
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

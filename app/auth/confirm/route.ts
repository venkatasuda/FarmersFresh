import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Email-confirmation landing. Supabase's confirmation link points here with a
 * token_hash; we verify it, which activates the account, then send the
 * customer to the login page with a success flag.
 *
 * A Route Handler (not a page) because it must exchange the token and write
 * the session cookie — only handlers and actions can set cookies.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  const done = url.clone();
  done.pathname = "/account/login";
  done.search = "";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: type as any,
      token_hash: tokenHash,
    });
    if (!error) {
      // Confirmed and signed in — send them to their account.
      done.pathname = "/account";
      return NextResponse.redirect(done);
    }
  }

  done.searchParams.set("confirmed", "1");
  return NextResponse.redirect(done);
}

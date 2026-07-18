import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Membership = {
  role: "owner" | "manager" | "staff" | "accountant";
  locationId: string;
  locationName: string;
  locationType: "farm" | "store";
  locationCode: string | null;
};

export type Session = {
  userId: string;
  email: string | null;
  fullName: string | null;
  isOwner: boolean;
  orgId: string;
  orgName: string;
  memberships: Membership[];
};

/**
 * Loads the signed-in user plus their org and location memberships.
 *
 * Every query below runs as the user, so RLS is doing the real work — if the
 * policies are wrong these come back empty rather than leaking another org.
 *
 * Redirects to /login if there is no session. `proxy.ts` should catch that
 * first; this is the second lock on the same door, for when a route is reached
 * some way the matcher didn't cover.
 */
export async function requireSession(): Promise<Session> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, is_owner, org_id")
    .eq("id", user.id)
    .maybeSingle();

  // Authenticated with Supabase but no profile row: the bootstrap block in
  // migration 0001 was never run for this user. Don't pretend it's fine.
  //
  // Send them through /auth/signout rather than straight to /login. Their token
  // is still valid, so proxy.ts would bounce them from /login back to
  // /dashboard, back to here, forever. Clearing the session breaks the loop.
  if (profileError || !profile) {
    redirect(
      `/auth/signout?error=${encodeURIComponent(
        "Your account isn't linked to an organisation yet. Ask the owner to set it up."
      )}`
    );
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", profile.org_id)
    .maybeSingle();

  const { data: rows } = await supabase
    .from("memberships")
    .select("role, location_id, locations(id, name, type, code)")
    .eq("user_id", user.id);

  type MembershipRow = {
    role: Membership["role"];
    location_id: string;
    locations:
      | { id: string; name: string; type: "farm" | "store"; code: string | null }
      | { id: string; name: string; type: "farm" | "store"; code: string | null }[]
      | null;
  };

  const memberships: Membership[] = ((rows ?? []) as MembershipRow[])
    .map((r) => {
      // PostgREST returns an embedded row as an object or an array of one,
      // depending on how it infers the relationship. Handle both.
      const loc = Array.isArray(r.locations) ? r.locations[0] : r.locations;
      if (!loc) return null;
      return {
        role: r.role,
        locationId: loc.id,
        locationName: loc.name,
        locationType: loc.type,
        locationCode: loc.code,
      } satisfies Membership;
    })
    .filter((m): m is Membership => m !== null);

  return {
    userId: profile.id,
    email: user.email ?? null,
    fullName: profile.full_name,
    isOwner: profile.is_owner,
    orgId: profile.org_id,
    orgName: org?.name ?? "Unknown organisation",
    memberships,
  };
}

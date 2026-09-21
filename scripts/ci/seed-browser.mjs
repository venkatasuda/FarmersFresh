#!/usr/bin/env node
// Confirm the browser job can reach the database with the service role before
// Playwright runs. The smoke tests hit public routes and don't depend on seeded
// catalogue data, so this stays a light connectivity check rather than a
// fragile fixture builder — richer seeding can be added here later if e2e grows
// to cover the authenticated shopping flow.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRole) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

const admin = createClient(url, serviceRole);
const { error, count } = await admin
  .from("organizations")
  .select("id", { count: "exact", head: true });

if (error) {
  console.error("Could not reach the database: " + error.message);
  process.exit(1);
}

console.log(`Database reachable. organizations rows: ${count ?? 0}`);

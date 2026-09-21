import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";

// A fresh CI database has no seeded rows, so these are STRUCTURAL assertions:
// they prove every security/concurrency migration actually shaped the functions
// and grants the way the reviews required. The behavioural concurrency proofs
// (double-redeem credits once, etc.) were run against the live DB with
// rolled-back transactions; here we guarantee the hardening is present on any
// database built from migrations, so a regression that drops a guard fails CI.

const DB_URL = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
const pool = DB_URL ? new Pool({ connectionString: DB_URL }) : null;

async function fnDef(name: string): Promise<string> {
  const { rows } = await pool!.query<{ def: string }>(
    `select pg_get_functiondef(p.oid) as def
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = $1
      limit 1`,
    [name]
  );
  return rows[0]?.def ?? "";
}

const run = DB_URL ? describe : describe.skip;

run("database security hardening", () => {
  beforeAll(() => {
    if (!DB_URL) throw new Error("SUPABASE_DB_URL is not set");
  });
  afterAll(async () => {
    await pool?.end();
  });

  it("financial RPCs require the financials.read capability (0082)", async () => {
    for (const fn of ["financials_overview", "margin_by_product", "sales_by_payment", "business_overview"]) {
      expect(await fnDef(fn)).toContain("require_permission");
    }
  });

  it("admin RPCs are permission-gated (0085)", async () => {
    for (const fn of ["update_store_settings", "issue_gift_card", "record_stock", "save_product", "create_purchase_order"]) {
      expect(await fnDef(fn)).toContain("require_permission");
    }
  });

  it("place_order consumes coupons within the usage cap (0086)", async () => {
    expect(await fnDef("place_order")).toContain("used_count < usage_limit");
  });

  it("reward claims are atomic conditional updates (0084)", async () => {
    expect(await fnDef("redeem_gift_card")).toMatch(/redeemed_at\s+is\s+null/i);
    expect(await fnDef("reveal_scratch_card")).toMatch(/revealed_at\s+is\s+null/i);
  });

  it("POS paths lock stock and check availability (0087)", async () => {
    const recordSale = await fnDef("record_sale");
    expect(recordSale).toContain("for update");
    expect(recordSale).toContain("is out of stock");
    expect(await fnDef("add_to_order")).toContain("for update");
  });

  it("notification worker claims atomically (0088)", async () => {
    expect(await fnDef("claim_notifications")).toMatch(/skip\s+locked/i);
  });

  it("wallet balance is org-scoped (0089)", async () => {
    expect(await fnDef("wallet_balance")).toContain("storefront_org_id");
  });

  it("receiving a PO locks the row (0090)", async () => {
    expect(await fnDef("receive_purchase_order")).toContain("for update");
  });

  it("staff cannot update the profiles.is_owner column (0076)", async () => {
    const { rows } = await pool!.query<{ column_name: string }>(
      `select column_name from information_schema.column_privileges
        where table_schema = 'public' and table_name = 'profiles'
          and grantee = 'authenticated' and privilege_type = 'UPDATE'`
    );
    const cols = rows.map((r) => r.column_name);
    expect(cols).not.toContain("is_owner");
    // The allowed columns are still grantable (sanity: the grant exists at all).
    expect(cols).toContain("full_name");
  });
});

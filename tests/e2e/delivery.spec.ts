import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

test("staff fulfil and collect COD, then a manager closes a completed cash day", async ({ page }) => {
  test.setTimeout(90_000);
  const dbUrl = new URL(process.env.TEST_DATABASE_URL ?? "");
  const apiUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  for (const url of [dbUrl, apiUrl]) {
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
      throw new Error("Delivery browser test refuses remote services.");
    }
  }
  const db = new pg.Pool({ connectionString: dbUrl.toString() });
  const auth = createClient(apiUrl.toString(), process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const org = randomUUID(), store = randomUUID(), order = randomUUID();
  const email = `delivery-${randomUUID()}@ci.invalid`, password = randomUUID();
  try {
    const { data, error } = await auth.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error("Could not create local delivery test identity.");
    const user = data.user.id;
    await db.query("insert into public.organizations(id,name,slug) values($1,'Delivery Browser Store',$2)", [org, `delivery-${org}`]);
    await db.query("insert into public.locations(id,org_id,type,name) values($1,$2,'store','Browser Store')", [store, org]);
    await db.query("insert into public.profiles(id,org_id,full_name) values($1,$2,'Browser Rider')", [user, org]);
    await db.query("insert into public.memberships(org_id,user_id,location_id,role) values($1,$2,$3,'staff')", [org, user, store]);
    await db.query(`insert into public.orders(id,org_id,location_id,order_number,contact_name,contact_phone,address_line,status,total)
      values($1,$2,$3,$4,'Browser Customer','9876543210','Synthetic delivery address','packed',100)`, [order, org, store, `BROWSER-${order}`]);

    await page.goto("/login?next=/dashboard/deliveries");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/deliveries/, { timeout: 15000 });
    await page.getByRole("button", { name: "Go on shift", exact: true }).click();
    await expect(page.getByRole("button", { name: "On shift ✓", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Take this delivery", exact: true }).click();
    await page.getByRole("button", { name: "Start delivery", exact: true }).click();
    await expect(page.getByRole("button", { name: "Release delivery", exact: true })).toHaveCount(0);
    await page.getByLabel("Delivery problem").fill("Customer unavailable");
    await page.getByRole("button", { name: "Report failed delivery", exact: true }).click();
    await expect(page.getByText("Failed delivery: Customer unavailable", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark delivered", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Share my location", exact: true })).toHaveCount(0);
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Confirm returned to store", exact: true }).click();
    await page.getByRole("button", { name: "Take this delivery", exact: true }).click();
    await page.getByRole("button", { name: "Start delivery", exact: true }).click();
    await page.getByRole("button", { name: "Mark delivered", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Nothing to deliver", exact: true })).toBeVisible();

    const saved = (await db.query("select status,total,is_paid,assigned_to,delivery_failure_note from public.orders where id=$1", [order])).rows[0];
    expect(saved).toMatchObject({ status: "delivered", total: "100.00", is_paid: false, assigned_to: user, delivery_failure_note: null });
    const events = (await db.query(`select event_type,count(*)::int n from public.events
      where entity_id=$1 and event_type in ('delivery.failed','delivery.returned') group by event_type order by event_type`, [order])).rows;
    expect(events).toEqual([{ event_type: "delivery.failed", n: 1 }, { event_type: "delivery.returned", n: 1 }]);

    await page.goto("/dashboard/cash");
    await expect(page.getByRole("heading", { name: "Daily cash closing", exact: true })).toHaveCount(0);
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Record cash collected", exact: true }).click();
    await expect(page.getByText("No outstanding COD collections.", { exact: true })).toBeVisible();
    expect((await db.query("select is_paid from public.orders where id=$1", [order])).rows[0].is_paid).toBe(true);
    await db.query("update public.memberships set role='manager' where user_id=$1", [user]);
    const yesterday = (await db.query("select to_char((clock_timestamp() at time zone 'Asia/Kolkata')::date-1,'YYYY-MM-DD') as business_date")).rows[0].business_date;
    await page.goto(`/dashboard/cash?date=${yesterday}`);
    await page.getByLabel("Counted cash receipts (₹)").fill("0");
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Close cash day", exact: true }).click();
    await expect(page.getByText(/Closed · Counted/)).toBeVisible();
    await page.getByLabel("Opening till cash (₹)").fill("100");
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Open till shift", exact: true }).click();
    await expect(page.getByRole("button", { name: "Close till shift", exact: true })).toBeVisible();
    const ret = randomUUID();
    await db.query("insert into public.returns(id,org_id,order_id,order_number,reason) select $1,org_id,id,order_number,'Browser damage' from public.orders where id=$2",[ret,order]);
    await page.reload();
    await page.getByLabel("Cash refund (₹)").fill("20");
    await page.getByLabel("Refund reason", { exact: true }).fill("Damaged goods returned");
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Record cash refund", exact: true }).click();
    await expect(page.getByRole("button", { name: "Record cash refund", exact: true })).toHaveCount(0);
    await expect(page.getByText(/expected ₹80/)).toBeVisible();
    await page.getByLabel("Counted till cash (₹)").fill("80");
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Close till shift", exact: true }).click();
    await expect(page.getByRole("button", { name: "Open till shift", exact: true })).toBeVisible();
    expect((await db.query("select expected,counted,difference from public.cash_shifts where location_id=$1",[store])).rows[0]).toMatchObject({expected:"80.00",counted:"80.00",difference:"0.00"});
    await page.goto("/dashboard/operations");
    await expect(page.getByRole("heading",{name:"Store operations",exact:true})).toBeVisible();
    await expect(page.getByRole("link",{name:"Staff access",exact:true})).toHaveCount(0);
    await page.goto("/dashboard/staff");
    // Streamed Next.js notFound responses can use HTTP 200; verify the denial UI and absence of the protected form.
    await expect(page.getByRole("heading",{name:"We couldn't find that",exact:true})).toBeVisible();
    await expect(page.getByRole("button",{name:"Save staff access",exact:true})).toHaveCount(0);
    const clerk=randomUUID();
    await db.query("insert into auth.users(id,email) values($1,$2)",[clerk,`${clerk}@ci.invalid`]);
    await db.query("insert into public.profiles(id,org_id,full_name) values($1,$2,'Browser Clerk')",[clerk,org]);
    await db.query("update public.profiles set is_owner=true where id=$1",[user]);
    await page.goto("/dashboard/staff");
    await page.getByRole("combobox",{name:"Staff member",exact:true}).selectOption(clerk);
    await page.getByRole("combobox",{name:"Access role",exact:true}).selectOption("manager");
    await page.getByLabel("Reason",{exact:true}).fill("Browser assignment review");
    page.once("dialog",dialog=>dialog.accept());
    await page.getByRole("button",{name:"Save staff access",exact:true}).click();
    await expect(page.getByRole("status")).toHaveText("Access updated.");
    expect((await db.query("select role from public.memberships where user_id=$1",[clerk])).rows[0].role).toBe("manager");
    await page.getByRole("combobox",{name:"Access role",exact:true}).selectOption("");
    await page.getByLabel("Reason",{exact:true}).fill("Browser access revoked");
    page.once("dialog",dialog=>dialog.accept());
    await page.getByRole("button",{name:"Save staff access",exact:true}).click();
    await expect(page.getByText(/none · Browser access revoked/)).toBeVisible();
    expect((await db.query("select role from public.memberships where user_id=$1",[clerk])).rows).toEqual([]);
  } finally {
    await db.end();
  }
});

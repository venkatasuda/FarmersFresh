import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
const args = ["status", "-o", "json"];
if (process.argv[2]) args.push("--workdir", process.argv[2]);
const status = JSON.parse(execFileSync("supabase", args, { encoding: "utf8" }));
const values = {
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  TEST_DATABASE_URL: status.DB_URL,
  NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000",
  RAZORPAY_WEBHOOK_SECRET: "ci-only-webhook-secret",
  RAZORPAY_KEY_SECRET: "ci-only-payment-secret",
};
for (const [key, value] of Object.entries(values)) {
  if (!value || /[\r\n]/.test(value)) throw new Error(`Missing/invalid local value: ${key}`);
  if (/KEY/.test(key)) console.log(`::add-mask::${value}`);
  appendFileSync(process.env.GITHUB_ENV ?? ".env.test.local", `${key}=${value}\n`);
}

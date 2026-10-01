// Explicit demo-only check. Pipe Supabase CLI API-key JSON through stdin; never log it.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import sharp from "sharp";

const preview = process.argv[2];
assert.match(preview ?? "", /^https:\/\/farmers-fresh-[a-z0-9]+-venkatasudas-projects\.vercel\.app$/);
const url = "https://bjevoybwufubtprkxbvb.supabase.co";
const keys = JSON.parse(readFileSync(0, "utf8"));
const secret = keys.find(k => k.name === "service_role")?.api_key;
const anon = keys.find(k => k.name === "anon")?.api_key;
assert(secret && anon, "Demo keys missing");
const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const directory = mkdtempSync(join(tmpdir(), "ff-demo-auth-"));
const headerFile = join(directory, "headers.txt"), imageFile = join(directory, "image.png");
const cookies = new Map();
const customer = createServerClient(url, anon, { cookies: {
  getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
  setAll: values => values.forEach(({ name, value }) => cookies.set(name, value)),
} });
const org = randomUUID(), password = randomUUID() + randomUUID();
let user, uploadedPath, orgCreated = false;
function check(result) { assert(!result.error, "Demo operation failed"); return result.data; }
function request(path, args = []) {
  writeFileSync(headerFile, "Cookie: " + [...cookies].map(([n, v]) => `${n}=${v}`).join("; "));
  const output = execFileSync(process.execPath, [process.env.npm_execpath || "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js",
    "exec", "--yes", "--package=vercel", "--", "vercel", "curl", path, "--deployment", preview, "--",
    "--silent", "--show-error", "--header", "@" + headerFile, "--write-out", "FF_STATUS%{http_code}", ...args],
  { encoding: "utf8", env: { ...process.env, VERCEL_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"] });
  const trimmed = output.trimEnd();
  const split = trimmed.lastIndexOf("FF_STATUS");
  assert(split >= 0, "Missing HTTP status marker");
  return { status: Number(trimmed.slice(split + 9)), body: trimmed.slice(0, split) };
}
try {
  user = check(await admin.auth.admin.createUser({ email: `hosted-${randomUUID()}@example.invalid`, password, email_confirm: true })).user;
  assert(user, "Test user missing");
  check(await customer.auth.signInWithPassword({ email: user.email, password }));
  assert.equal(check(await customer.auth.getUser()).user.id, user.id);
  assert.equal(request("/account").status, 200, "Signed-in customer account");
  assert.equal(request("/api/product-images", ["--request", "POST", "--data-binary", "invalid"]).status, 403, "Customer upload denial");
  check(await admin.from("organizations").insert({ id: org, name: "Hosted Upload Test", slug: "hosted-" + org, storefront_enabled: false }));
  orgCreated = true;
  check(await admin.from("profiles").insert({ id: user.id, org_id: org, is_owner: true }));
  assert.equal(request("/api/product-images", ["--request", "POST", "--data-binary", "<svg></svg>"]).status, 415, "Invalid image rejection");
  writeFileSync(imageFile, await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 40, g: 120, b: 60 } } }).png().toBuffer());
  const uploaded = request("/api/product-images", ["--request", "POST", "--header", "Content-Type: image/png", "--data-binary", "@" + imageFile]);
  assert.equal(uploaded.status, 200, "Owner image upload");
  const imageUrl = new URL(JSON.parse(uploaded.body).url);
  assert.equal(imageUrl.origin, url);
  const prefix = "/storage/v1/object/public/product-images/";
  assert(imageUrl.pathname.startsWith(prefix));
  uploadedPath = imageUrl.pathname.slice(prefix.length);
  assert(uploadedPath.startsWith(user.id + "/"));
  const downloaded = check(await admin.storage.from("product-images").download(uploadedPath));
  assert.equal((await sharp(Buffer.from(await downloaded.arrayBuffer())).metadata()).format, "jpeg", "Image re-encoding");
  console.log("Hosted sign-in, customer account, upload permissions, invalid-image rejection and owner JPEG upload passed.");
} finally {
  if (uploadedPath) check(await admin.storage.from("product-images").remove([uploadedPath]));
  if (user) check(await admin.from("profiles").delete().eq("id", user.id));
  if (orgCreated) check(await admin.from("organizations").delete().eq("id", org));
  if (user) check(await admin.auth.admin.deleteUser(user.id));
  assert(resolve(directory).startsWith(resolve(tmpdir()) + (process.platform === "win32" ? "\\" : "/")));
  rmSync(directory, { recursive: true, force: true });
  console.log("Temporary account, organization and uploaded file removed.");
}

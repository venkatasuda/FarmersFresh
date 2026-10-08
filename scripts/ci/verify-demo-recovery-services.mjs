// Pipe demo API-key JSON through stdin. Credentials never enter reports or arguments.
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, join, sep } from "node:path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const offsite = process.argv[2] === "--confirmed-offsite-demo-local";
assert(offsite || process.argv[2] === "--confirmed-demo-local", "Explicit local demo recovery flag required.");
const directory = resolve(process.argv[3] || "reports/recovery-2026-10-02");
assert(directory.startsWith(resolve("reports") + sep));
const databaseReport = JSON.parse(readFileSync(join(directory, "database-verification.json"), "utf8"));
assert(databaseReport.passed, "Verify the restored database first.");
const keys = offsite ? [] : JSON.parse(readFileSync(0, "utf8").replace(/^\uFEFF/, ""));
const sourceKey = keys.find(k => k.name === "service_role")?.api_key;
if (!offsite) assert(sourceKey, "Demo service key missing.");
const local = JSON.parse(readFileSync(join(directory, "local-credentials.json"), "utf8").replace(/^\uFEFF/, ""));
assert.equal(local.API_URL, offsite ? "http://127.0.0.1:56321" : "http://127.0.0.1:55321", "Only the isolated local recovery API is allowed.");
if (offsite) assert.equal(databaseReport.target, "supabase_db_farmersfresh-offsite-restore");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const source = offsite ? null : createClient("https://bjevoybwufubtprkxbvb.supabase.co", sourceKey, options);
const target = createClient(local.API_URL, local.SERVICE_ROLE_KEY, options);
const customer = createClient(local.API_URL, local.ANON_KEY, options);
const check = (result, label) => { assert(!result.error, `${label} failed`); return result.data; };
const owners = check(await target.from("profiles").select("id").eq("is_owner", true), "Restored owners");
const users = check(await target.auth.admin.listUsers(), "Restored Auth users").users;
const owner = users.find(u => owners.some(p => p.id === u.id) && u.email && (!u.banned_until || Date.parse(u.banned_until) < Date.now()));
assert(owner, "No active restored owner to verify.");
// Generate a local one-use login token; no message is sent and no password is changed.
const link = check(await target.auth.admin.generateLink({ type: "magiclink", email: owner.email }), "Local login link");
const login = check(await customer.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token }), "Restored account login");
assert.equal(login.user.id, owner.id);
const counts = check(await customer.rpc("portal_operations_metrics"), "Restored owner permissions");
assert.equal(counts.length, 8);
if (offsite) {
  const path = `recovery-drill/${randomUUID()}.jpg`;
  const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 40, g: 120, b: 60 } } }).jpeg().toBuffer();
  const upload = await customer.storage.from("product-images").upload(path, image, { contentType: "image/jpeg" });
  if (!upload.error) check(await target.storage.from("product-images").remove([path]), "Unexpected upload cleanup");
  assert(upload.error, "Restored policies must deny direct product-image uploads, including owners.");
  assert.equal(Number(upload.error.statusCode), 403, "Upload must be rejected by authorization.");
}
check(await customer.auth.signOut(), "Local logout");

if (offsite) {
  const inventory = JSON.parse(readFileSync(join(directory, "storage.json"), "utf8"));
  const expected = databaseReport.manifest.find(t => t.table === '"storage"."objects"')?.rows;
  assert.equal(inventory.objects.length, expected, "Backup object inventory differs from restored metadata.");
  for (const object of inventory.objects) {
    assert.match(object.path, /^objects\/[a-f0-9]{64}$/);
    const bytes = readFileSync(join(directory, object.path));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), object.sha256);
    check(await target.storage.from(object.bucket).upload(object.name, bytes, { contentType: object.contentType, upsert: true }), "Offsite object restore");
    const restored = check(await target.storage.from(object.bucket).download(object.name), "Restored object read");
    assert.equal(createHash("sha256").update(Buffer.from(await restored.arrayBuffer())).digest("hex"), object.sha256);
  }
  const buckets = check(await target.storage.listBuckets(), "Restored buckets");
  assert.deepEqual(buckets.map(b => b.id).sort(), inventory.buckets.map(b => b.id).sort());
  writeFileSync(join(directory, "services-verification.json"), JSON.stringify({ passed: true, offsite: true,
    restoredAccountLogin: true, restoredOwnerPermissions: true, directOwnerUploadDenied: true, storageObjectsRestored: inventory.objects.length,
    storageBucketsVerified: buckets.length, finishedAt: new Date().toISOString() }, null, 2));
  console.log("Offsite restored account login, owner permissions, and Storage inventory verified.");
  process.exit(0);
}

const bucket = "product-images", path = `recovery-drill/${randomUUID()}.jpg`;
const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 40, g: 120, b: 60 } } }).jpeg().toBuffer();
const digest = data => createHash("sha256").update(data).digest("hex");
let sourceCreated = false, targetCreated = false;
try {
  check(await source.storage.from(bucket).upload(path, image, { contentType: "image/jpeg", upsert: false }), "Synthetic demo upload");
  sourceCreated = true;
  const original = check(await source.storage.from(bucket).download(path), "Hosted file backup");
  const backup = Buffer.from(await original.arrayBuffer());
  writeFileSync(join(directory, "synthetic-image-backup.jpg"), backup);
  check(await target.storage.from(bucket).upload(path, readFileSync(join(directory, "synthetic-image-backup.jpg")), { contentType: "image/jpeg", upsert: false }), "Replacement file restore");
  targetCreated = true;
  const restored = check(await target.storage.from(bucket).download(path), "Replacement file read");
  assert.equal(digest(Buffer.from(await restored.arrayBuffer())), digest(backup));
  assert.equal(digest(backup), digest(image));
} finally {
  const cleanup = await Promise.allSettled([
    targetCreated ? target.storage.from(bucket).remove([path]) : Promise.resolve({ error: null }),
    sourceCreated ? source.storage.from(bucket).remove([path]) : Promise.resolve({ error: null }),
  ]);
  assert(cleanup.every(r => r.status === "fulfilled" && !r.value.error), "Synthetic cleanup failed.");
}
writeFileSync(join(directory, "services-verification.json"), JSON.stringify({ passed: true, restoredAccountLogin: true,
  restoredOwnerPermissions: true, syntheticHostedToLocalImage: true, imageSha256: digest(image),
  sourceObjectCountAtBackup: databaseReport.manifest.find(t => t.table === '"storage"."objects"')?.rows,
  syntheticObjectsRemoved: true, finishedAt: new Date().toISOString() }, null, 2));
console.log("Restored account login, owner permissions, and hosted-to-local image bytes verified; synthetic objects removed.");

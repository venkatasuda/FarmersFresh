// Actual Alertmanager delivery to a loopback-only synthetic receiver; no real messages.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { setTimeout } from "node:timers/promises";

assert(process.env.CI === "true" && process.platform === "linux", "Requires Linux disposable CI with Docker");
const directory = mkdtempSync(join(tmpdir(), "ff-alert-delivery-"));
const container = "ff-alert-test-" + randomUUID();
const deliveries = [];
const receiver = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/alerts") { response.writeHead(404).end(); return; }
  try {
    const chunks = []; let size = 0;
    for await (const chunk of request) { size += chunk.length; assert(size < 65536); chunks.push(chunk); }
    deliveries.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    response.writeHead(200).end("ok");
  } catch { response.writeHead(400).end(); }
});
await new Promise(resolve => receiver.listen(0, "127.0.0.1", resolve));
async function until(predicate) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (await predicate().catch(() => false)) return;
    await setTimeout(100);
  }
  throw new Error("Alert delivery timed out");
}
try {
  const config = join(directory, "alertmanager.yml");
  writeFileSync(config, `route:
  receiver: synthetic
  group_by: [alertname]
  group_wait: 1s
  group_interval: 1s
  repeat_interval: 1h
receivers:
  - name: synthetic
    webhook_configs:
      - url: http://127.0.0.1:${receiver.address().port}/alerts
        send_resolved: true
`);
  execFileSync("docker", ["run", "--detach", "--rm", "--name", container, "--network", "host",
    "-v", `${config}:/etc/alertmanager/alertmanager.yml:ro`, "prom/alertmanager:v0.34.1",
    "--config.file=/etc/alertmanager/alertmanager.yml", "--web.listen-address=127.0.0.1:19093", "--cluster.listen-address="], { stdio: "pipe" });
  await until(async () => (await fetch("http://127.0.0.1:19093/-/ready")).ok);
  const alert = { labels: { alertname: "FarmersFreshRefundPending", severity: "critical", environment: "synthetic-ci" },
    annotations: { summary: "Synthetic refund alert" }, startsAt: new Date(Date.now() - 10000).toISOString(),
    endsAt: new Date(Date.now() + 60000).toISOString() };
  async function post() {
    const response = await fetch("http://127.0.0.1:19093/api/v2/alerts", { method: "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify([alert]) });
    assert(response.ok, "Synthetic alert ingestion failed");
  }
  await post(); await post();
  await until(async () => deliveries.some(message => message.status === "firing"));
  assert.equal(deliveries.filter(message => message.status === "firing").length, 1, "Duplicate alerts must group into one delivery");
  assert.equal(deliveries[0].alerts.length, 1);
  alert.endsAt = new Date().toISOString(); await post();
  await until(async () => deliveries.some(message => message.status === "resolved"));
  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/alert-delivery.json", JSON.stringify({ passed: true, firingDelivered: true,
    resolvedDelivered: true, duplicateGrouped: true, recipient: "loopback synthetic receiver" }, null, 2));
  console.log("Alertmanager delivered firing/resolved notifications and grouped duplicate alerts locally.");
} finally {
  try { execFileSync("docker", ["rm", "--force", container], { stdio: "pipe" }); } catch { /* already removed */ }
  await new Promise(resolve => receiver.close(resolve));
  assert(resolve(directory).startsWith(resolve(tmpdir()) + sep));
  rmSync(directory, { recursive: true, force: true });
}

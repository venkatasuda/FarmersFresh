// Read-only catalogue journey. CI stays local; the explicit demo profile uses
// the approved hosted site. Writes/payment load need an isolated environment.
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.LOAD_TARGET || "http://127.0.0.1:3000";
const demo = __ENV.LOAD_PROFILE === "launch-demo";
if (demo ? BASE !== "https://farmersfresh.vercel.app" : !/^http:\/\/(127\.0\.0\.1|localhost):3000$/.test(BASE)) throw new Error("Load target is not approved.");
const product = demo ? __ENV.LOAD_PRODUCT_SLUG : "ci-fresh-product";
if (!/^[a-z0-9-]+$/.test(product || "")) throw new Error("A published product slug is required.");
const params = { headers: {} };
if (__ENV.LOAD_BYPASS_FILE) {
  if (!demo) throw new Error("Automation credentials are restricted to the approved demo profile.");
  const secret = open(__ENV.LOAD_BYPASS_FILE).trim();
  if (!secret || /[\r\n]/.test(secret)) throw new Error("Invalid automation credential file.");
  params.headers["x-vercel-protection-bypass"] = secret;
}

export const options = {
  stages: [
    { duration: demo ? "30s" : "10s", target: demo ? 50 : 20 },
    { duration: demo ? "2m" : "20s", target: demo ? 50 : 20 },
    { duration: "5s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500"],
    checks: ["rate>0.99"],
  },
};

const paths = ["/", demo ? "/search?q=rice" : "/search?q=CI", `/shop/${product}`, "/cart"];
export function setup() {
  for (const path of paths) {
    const response = http.get(`${BASE}${path}`, params);
    if (response.status !== 200) throw new Error(`Preflight ${path}: HTTP ${response.status}, mitigation ${response.headers["X-Vercel-Mitigated"] || "none"}. Load was not started.`);
  }
}

export default function publicReadLoad() {
  for (const path of paths) {
    const res = http.get(`${BASE}${path}`, { ...params, tags: { journey: "catalogue", route: path.split("?")[0] } });
    check(res, { "status is 200": (r) => r.status === 200 });
    sleep(0.25);
  }
  sleep(1);
}

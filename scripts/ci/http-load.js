// Catalogue journey over the representative local browser seed. Read-only;
// higher-volume writes/payment load require a separate disposable environment.
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.LOAD_TARGET || "http://127.0.0.1:3000";
if (!/^http:\/\/(127\.0\.0\.1|localhost):3000$/.test(BASE)) throw new Error("Load test requires the disposable local app.");

export const options = {
  stages: [
    { duration: "10s", target: 20 },
    { duration: "20s", target: 20 },
    { duration: "5s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500"],
    checks: ["rate>0.99"],
  },
};

export default function publicReadLoad() {
  for (const path of ["/", "/search?q=CI", "/shop/ci-fresh-product", "/cart"]) {
    const res = http.get(`${BASE}${path}`, { tags: { journey: "catalogue", route: path.split("?")[0] } });
    check(res, { "status is 200": (r) => r.status === 200 });
    sleep(0.25);
  }
  sleep(1);
}

// k6 public-read load smoke — NOT a production capacity certification. It just
// confirms the public sign-in route stays fast and error-free under light,
// concurrent load. Run by the production-browser CI job against the started app.
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.LOAD_TARGET || "http://127.0.0.1:3000";

export const options = {
  stages: [
    { duration: "10s", target: 10 },
    { duration: "20s", target: 10 },
    { duration: "5s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500"],
  },
};

export default function () {
  const res = http.get(`${BASE}/login`);
  check(res, { "status is 200": (r) => r.status === 200 });
  sleep(1);
}

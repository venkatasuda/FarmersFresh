import http from 'k6/http';
import { check, sleep } from 'k6';
export const options = {
  scenarios: { public_read_burst: { executor: 'constant-vus', vus: 10, duration: '20s' } },
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<2000'], checks: ['rate>0.99'] },
};
export default function publicReadBurst() {
  const path=['/','/cart','/login'][__ITER % 3];
  const response=http.get(`http://127.0.0.1:3000${path}`);
  check(response, {'successful public read': r=>r.status===200});
  sleep(0.2);
}

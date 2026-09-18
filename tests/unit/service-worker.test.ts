import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
function worker(options: { offline?: boolean; missingFallback?: boolean } = {}) {
  const listeners: Record<string, (event: unknown) => void> = {};
  const stored: string[] = [], matched: string[] = [], deleted: string[] = [];
  let claimed = false;
  const response = new Response('Fresh HTML', { status: 200 });
  const fallback = new Response('Generic offline page', { status: 200 });
  const cache = {
    put: async (request: { url: string }) => stored.push(request.url),
    match: async (path: string) => { matched.push(path); return options.missingFallback ? undefined : fallback; },
  };
  const context = {
    self: {
      location: { origin: 'https://ci.invalid' },
      addEventListener: (type: string, fn: (event: unknown) => void) => listeners[type] = fn,
      clients: { claim: async () => { claimed = true; } },
    },
    URL, Response,
    fetch: async () => { if (options.offline) throw new Error('Offline'); return response; },
    caches: {
      open: async () => cache,
      keys: async () => ['ff-v1', 'ff-v2', 'ff-v3', 'another-app'],
      delete: async (key: string) => { deleted.push(key); return true; },
    },
  };
  vm.runInNewContext(readFileSync('public/sw.js', 'utf8'), context);
  return { listeners, stored, matched, deleted, claimed: () => claimed };
}
function navigation(w: ReturnType<typeof worker>, path = '/') {
  let pending: Promise<Response> | undefined;
  w.listeners.fetch({ request: { method: 'GET', mode: 'navigate', url: 'https://ci.invalid' + path }, respondWith: (promise: Promise<Response>) => pending = promise });
  return pending;
}
describe('PWA privacy', () => {
  it.each(['/dashboard', '/staff', '/admin', '/pos', '/account', '/checkout', '/api/razorpay/order', '/track/x'])('does not intercept private navigation %s', path => {
    const w = worker(); expect(navigation(w, path)).toBeUndefined();
  });
  it('never stores personalised homepage HTML', async () => {
    const w = worker(); const result = await navigation(w);
    expect(await result?.text()).toBe('Fresh HTML'); expect(w.stored).toEqual([]);
  });
  it('uses only the generic offline fallback, never cached requested HTML', async () => {
    const w = worker({ offline: true }); const result = await navigation(w);
    expect(await result?.text()).toBe('Generic offline page'); expect(w.matched).toEqual(['/offline']); expect(w.stored).toEqual([]);
  });
  it('returns a generic unavailable response if offline fallback is absent', async () => {
    const w = worker({ offline: true, missingFallback: true }); const result = await navigation(w);
    expect(result?.status).toBe(503); expect(await result?.text()).toContain('offline');
  });
  it('activation purges earlier Farmers Fresh caches before taking control', async () => {
    const w = worker(); let pending: Promise<void> | undefined;
    w.listeners.activate({ waitUntil: (promise: Promise<void>) => pending = promise }); await pending;
    expect(w.deleted).toEqual(['ff-v1', 'ff-v2']); expect(w.claimed()).toBe(true);
  });
});

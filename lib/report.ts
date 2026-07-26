/**
 * Dependency-free error reporting.
 *
 * The full @sentry/nextjs SDK is the eventual home for this, but it needs an
 * npm install and config files. This gives real error capture NOW with zero
 * new dependencies and no build change: set NEXT_PUBLIC_SENTRY_DSN and errors
 * are POSTed straight to Sentry's ingest endpoint. Leave it unset and this is
 * a structured console log.
 *
 * It is wrapped so it can NEVER throw — a reporter that crashes while
 * reporting a crash is worse than no reporter. Every path is guarded.
 */

type Context = Record<string, unknown>;

function parseDsn(dsn: string): { url: string; key: string } | null {
  try {
    // https://<publicKey>@<host>/<projectId>
    const m = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(.+)$/);
    if (!m) return null;
    const [, key, host, projectId] = m;
    // Classic store endpoint — a plain JSON event, simpler and lower-risk
    // than the envelope format.
    return {
      url: `https://${host}/api/${projectId}/store/?sentry_key=${key}&sentry_version=7`,
      key,
    };
  } catch {
    return null;
  }
}

function eventId(): string {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    return Math.random().toString(16).slice(2).padEnd(32, "0");
  }
}

export function reportError(error: unknown, context?: Context): void {
  const err =
    error instanceof Error ? error : new Error(String(error ?? "unknown"));

  // Always leave a structured trace, wherever this runs.
  console.error("[report]", err.message, context ?? "");

  const dsn =
    process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN ?? "";
  if (!dsn) return;

  const target = parseDsn(dsn);
  if (!target) return;

  const payload = {
    event_id: eventId(),
    timestamp: new Date().toISOString(),
    platform: "javascript",
    level: "error",
    environment: process.env.NODE_ENV ?? "production",
    server_name: "farmers-fresh",
    exception: {
      values: [
        {
          type: err.name || "Error",
          value: err.message || "Unknown error",
        },
      ],
    },
    extra: context ?? {},
  };

  // Fire and forget. Never await, never let a failed report surface.
  try {
    void fetch(target.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // no-op
  }
}

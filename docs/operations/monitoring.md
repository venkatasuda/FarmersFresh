# Error monitoring — "how do I know when it breaks?"

## Open-source business monitoring

`ops/monitoring/` provisions Prometheus, Grafana and optional Alertmanager, a business dashboard and
alert rules. It is separate from the optional Sentry error reporter below.

1. Generate two different random secrets. Set `MONITORING_TOKEN` (at least 32
   characters) in the application's **server** hosting environment. Store the
   same token in `ops/monitoring/secrets/monitoring_token`; put the Grafana admin
   password in `ops/monitoring/secrets/grafana_password`. These files are ignored
   by Git. Never use a `NEXT_PUBLIC_` variable for either secret.
2. Apply the operations migration and deploy the application. In
   `ops/monitoring/prometheus.yml`, set the target to the deployed application
   hostname. Protected Vercel previews require hosting access first.
3. On a host with Docker Engine, run
   `docker compose -f ops/monitoring/compose.yml up -d`.
   Grafana is at `http://localhost:3100`; use account `admin` and your password.
   Prometheus is at `http://localhost:9090`. Ports bind to loopback only; use an
   SSH tunnel for remote access. No anonymous dashboard access is enabled.
4. Confirm `up{job="farmersfresh"}=1`, then open **Farmers Fresh operations**.
   Check that a deliberately created *demo* refund-pending order is visible and
   fires the payment alert after five minutes; resolve it through the verified
   operational workflow, never by forging payment flags.
5. Copy `alertmanager.example.yml` to `ops/monitoring/secrets/alertmanager.yml`.
   Replace the SMTP host, sender, username and recipient with your actual settings;
   save the SMTP password in `ops/monitoring/secrets/smtp_password`. Keep both
   files private and out of Git. Start delivery with
   `docker compose -f ops/monitoring/compose.yml --profile alerts up -d`.
   Prometheus forwards the existing rules to Alertmanager; Grafana shows the data.
   No duplicate Grafana alert rules are required. Verify both firing and resolved
   emails reach the chosen recipient before launch. The base profile has no delivery.

The metrics endpoint returns counts only and refuses missing/incorrect tokens.
No customer information, payment payloads or exception messages are exported.
Its five-second database timeout returns 503, making scrape failures visible.
Low stock currently means at most five units in each shop's storefront location.
Review that threshold against product units; this is a starting operational rule.
Order alerts use a 24-hour processing deadline and a 45-minute unpaid deadline.
Counters covering the last day remain elevated until their window expires.
Aggregates span organizations; add store labels when operators need store-level
triage. Software is open source; deployment still requires a running host.

CI validates rules, tests target-down/refund alerts, and runs a real Alertmanager
container against a loopback receiver to verify firing/resolved delivery and
duplicate grouping. This is not proof of your SMTP server or recipient delivery.
The stack has not
been started on a persistent host simply because these files exist.
References: [Prometheus alerting rules](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/),
[Grafana Docker configuration](https://grafana.com/docs/grafana/latest/setup-grafana/configure-docker/).

Farmers Fresh has two layers of crash protection:

1. **Error boundaries** (`app/error.tsx`, `app/(app)/error.tsx`, `app/global-error.tsx`) —
   if any screen throws, the customer or staff member sees a friendly "try
   again" card, never a white screen. The site keeps working.

2. **Error reporting** (`lib/report.ts`) — when a boundary catches something,
   it calls `reportError()`, which logs it and, if a Sentry DSN is set, sends
   it to Sentry so you find out.

## Turn on Sentry (5 minutes, no code)

The lightweight path needs **no npm install and no build change**.

1. Create a free account at [sentry.io](https://sentry.io) → new project → pick
   **"Browser JavaScript"** (any JS platform works).
2. Copy the **DSN** it gives you — it looks like
   `https://abc123@o456.ingest.sentry.io/789`.
3. Add it as an environment variable, in Vercel (Settings → Environment
   Variables) and in your local `.env.local`:

   ```
   NEXT_PUBLIC_SENTRY_DSN=https://abc123@o456.ingest.sentry.io/789
   ```

4. Redeploy. That's it — any crash now appears in your Sentry dashboard with
   the message and context, and Sentry emails you.

`reportError()` never throws and never blocks, so a Sentry outage can't affect
your site. With no DSN set, it's just a structured console log.

## Reading issues from here

The Sentry connector in this workspace can read your issues once the project
exists — ask me "what errors is Farmers Fresh seeing?" and I can pull them,
triage, and suggest fixes.

## Upgrading to the full SDK (later, optional)

The lightweight reporter captures the error message and context. If you later
want full stack traces, breadcrumbs, performance tracing and release tracking,
install the official SDK:

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

The wizard creates `sentry.*.config.ts` and wires `next.config.ts`. Once it's
in, you can point `lib/report.ts` at `Sentry.captureException` instead of the
raw endpoint, or remove `lib/report.ts` entirely and call Sentry directly. The
error boundaries don't change — only what `reportError` does under the hood.

# Error monitoring — "how do I know when it breaks?"

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

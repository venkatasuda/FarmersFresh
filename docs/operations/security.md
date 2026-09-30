# Security hardening and release requirements

The September 30 hardening changes are local code and a database migration. They
must ship together after database and browser CI passes. They have not changed a
hosted Supabase project, scheduler, or production deployment.

## Implemented controls

- Payment creation and verification require the record's authenticated owner.
  Guest orders use a signed, HttpOnly, same-site cookie issued by checkout,
  limited to payment routes and valid for one hour. Existing guest orders created
  before this release cannot start a new payment through these endpoints.
- Browser callbacks use constant-time signature comparison and fetch the payment
  from Razorpay. Only captured INR payments matching the stored order and amount
  reach the shared settlement function. Webhooks validate signed identifiers,
  currency, and amount. Membership settlement now checks the amount too.
- Payment, image search, and upload endpoints share atomic database rate limits:
  30 requests per minute per caller (10 for visual search), with a global ceiling
  of 20 times that limit. Missing limiter configuration or database errors fail
  closed. These limits do not replace Supabase Auth limits or ingress protection.
- JSON request bodies are bounded while streaming; malformed objects are
  rejected. Cross-origin browser API writes are rejected. Errors are generic and
  payment responses are not cached. The shared database error mapper uses an
  explicit list of customer-safe messages.
- Product uploads require an authenticated organization owner. Images are limited
  to 5 MB and 25 million pixels, decoded and re-encoded as JPEG with metadata
  removed, and stored under generated names. Restrictive Storage policies block
  direct browser writes, even if older permissive policies exist. Visual search
  uses the same decoder. Hosting platforms may enforce a smaller request limit.
- Staff login redirects reject backslashes and control characters. Supabase Auth
  still owns password authentication and its rate limits. Authorization remains
  in database permissions/RLS, with owner location access scoped to their org.
- The notification worker requires a dedicated scheduler bearer token. Provider
  calls have timeouts. Failed sends retry after five minutes, up to five attempts;
  delivery is at least once, so a crash after sending may still duplicate a send.
  Push URLs are restricted to supported Google, Mozilla and Apple endpoints in
  both new database writes and the worker. Other push providers fail closed.
- Cancellation locks the order before releasing stock. Purchase creation, its
  lines, and optional ordering now happen in one database transaction.

## Before release

1. Run the existing CI database and concurrency suites against a disposable
   Supabase instance, including `tests/database/hardening.test.ts`. Apply
   `20260930155322_security_hardening.sql` through the normal migration process.
2. Set a random `NOTIFICATION_WORKER_SECRET` of at least 32 characters in Edge
   Function secrets and in the scheduler's `Authorization: Bearer ...` header.
   Coordinate that configuration with the worker deployment; missing credentials
   intentionally stop notifications.
3. Supply server-only Supabase and Razorpay credentials to the application.
   Uploads and image search now also need the server key for their trusted paths.
   Never place a privileged key in a `NEXT_PUBLIC_` variable. The build rejects
   privileged keys in the configured public Supabase key field.
4. For non-Vercel hosts, either accept the shared caller budget or configure
   `RATE_LIMIT_IP_HEADER` to an ingress header that the proxy always overwrites.
5. Verify hosted Supabase Auth email confirmation, password policy, login/signup
   rate limits, redirect allowlist and staff MFA settings. The repository's local
   test configuration is not proof of hosted configuration. Review old stored
   images separately; the upload pipeline does not sanitize historical objects.
6. Exercise guest and signed-in checkout, duplicate webhooks, membership payment,
   owner uploads and notification delivery in staging before merging to deploy.

## Verification scope

The local unit/API suite covers malformed bodies, byte limits, cross-origin
rejection, limiter failure, payment ownership, expired/tampered guest cookies,
uncaptured/wrong-amount payments, image decoding, scheduler authentication and
push URL restrictions. Database tests cover transactional rollback, rate-limit
permissions, upload-policy bypass, tenant scope, retries and concurrent cancellation.

The local dependency audit reported zero known vulnerabilities. Gitleaks scanned
70 existing commits and current source without finding secrets. Those are bounded
checks, not a guarantee that every credential or application vulnerability is
absent. Hosted configuration and database execution remain separate release gates.

References: [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
and [server-side authentication](https://supabase.com/docs/guides/auth/server-side/creating-a-client).

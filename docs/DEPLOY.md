# Deploy checklist

Ordered. Each box is a real gate — don't skip ahead.

## 1. Green build locally
- [ ] `Remove-Item -Recurse -Force .next` (clears the stale route-types cache)
- [ ] `npm run build` → must finish with **no** type errors
- [ ] `npm run dev`, click through: home, a product, cart, checkout (COD), `/account`, `/dashboard`

## 2. Set env vars (names + locations in `.env.example`)
**Vercel → Project → Settings → Environment Variables** (Production):
- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Razorpay: `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`  *(skip → COD-only)*
- [ ] `NEXT_PUBLIC_VAPID_PUBLIC_KEY`  *(push)*
- [ ] Optional: visual-search, forecast, Sentry keys

**Supabase → Edge Functions → Secrets** (the notification worker):
- [ ] `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL`, `NOTIFY_SITE_URL`
- [ ] `MSG91_AUTHKEY`, `MSG91_SENDER` *(SMS)* · `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` *(WhatsApp)*
- [ ] `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`  *(same pair as Vercel's public)*

**Supabase → Auth → URL Configuration:**
- [ ] Site URL + Redirect URLs = your production domain (else auth emails point at localhost)

## 3. GitHub secrets (for CI/CD)
Repo → Settings → Secrets → Actions:
- [ ] CI: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] CD (only if using the deploy job): `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
- [ ] Decide CD: Vercel Git integration **or** the Actions `deploy` job — **not both** (delete one)

## 4. Pre-launch data
- [ ] Remove demo sales before real customers: they're tagged — the sale rows have
      `note = 'SEED_DEMO'`. Ledger is append-only, so "removing" = post opposing
      entries or accept them as history. Decide now, not after launch.
- [ ] Real product photos + prices + delivery PIN codes entered
- [ ] Keep the two real orders `FF-260726-0019`, `FF-260726-0024`

## 5. Ship
- [ ] `git push` → CI runs `build` (blocks merge if red)
- [ ] Deploy (Vercel auto, or the CD job) → open the production URL
- [ ] Smoke test on the live domain: place one COD order end-to-end; confirm it
      appears in `/dashboard/orders`

## 6. Day-2 (do soon, not never)
- [ ] Sentry DSN set → you see errors before customers report them
- [ ] Confirm the pg_cron jobs are alive: `expire-batches`, `expire-markdowns`,
      `run-subscriptions` (Supabase → Database → Cron)
- [ ] One test each: receive a PO (stock + cost land), log wastage, mark down an
      expiring item (price drops on storefront, reverts after its date)

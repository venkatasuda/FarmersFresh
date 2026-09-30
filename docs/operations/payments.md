# Online payments (Razorpay)

Cash/UPI on delivery is the default and always works. Online prepayment
(UPI, cards, netbanking) is **scaffolded and ready** — it switches on when you
add your Razorpay keys. No code changes needed.

## What's already built

- **Order fields** — `orders.is_paid`, `razorpay_order_id`, `razorpay_payment_id`,
  `paid_at`, and `mark_order_paid()` (callable only by the verified server).
- **`/api/razorpay/order`** — creates a Razorpay order for the amount, returns
  the id the checkout popup needs. No-ops with a clear message until keys exist.
- **`/api/razorpay/verify`** — verifies the payment signature **server-side**
  (a client can't fake a payment) and marks the order paid.

## Turn it on

1. Create a [Razorpay](https://razorpay.com) account and complete KYC.
2. Dashboard → Settings → API Keys → generate keys. You get a **Key ID**
   (starts `rzp_...`) and a **Key Secret**.
3. Add these environment variables (Vercel → Settings → Environment Variables,
   and `.env.local`):

   ```
   RAZORPAY_KEY_ID=rzp_live_xxx
   RAZORPAY_KEY_SECRET=your-secret
   NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxx
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # from Supabase API settings
   ```

4. Redeploy.

## The one remaining wiring step

The two server routes and the database are done. The last piece is the
**checkout button flow** on the client:

1. Add a "Pay online" option at checkout beside "Pay on delivery".
2. On choosing it: call `/api/razorpay/order` with the total → get
   `razorpayOrderId` → open the Razorpay checkout popup (their `checkout.js`
   script + `NEXT_PUBLIC_RAZORPAY_KEY_ID`).
3. On success, the popup returns `razorpay_payment_id` + `razorpay_signature`;
   POST them with the order id to `/api/razorpay/verify`.
4. On `{ ok: true }`, show the confirmation.

This is intentionally left for when your keys are live, so it can be tested end
to end against a real Razorpay account rather than shipped blind. Tell me once
your keys are in and I'll wire the button in ~30 minutes.

## Security notes

- The **signature is verified server-side** with your secret key before any
  order is marked paid — the browser is never trusted.
- `mark_order_paid()` is revoked from `anon` and `authenticated`; only the
  service-role server route can call it.
- The secret key lives only in server env, never shipped to the browser (only
  the public `NEXT_PUBLIC_RAZORPAY_KEY_ID` is).

# Online payments (Razorpay)

The checkout UI already supports Razorpay. Without provider keys, the storefront
uses cash on delivery. Treat configured payments as unverified until staging
acceptance passes.

## Existing flow

1. Checkout reserves stock and creates a held order in the database.
2. The browser sends its order ID to `/api/razorpay/order`. The server checks
   caller ownership (or the signed guest checkout cookie) and reads the amount
   from the order. The browser never supplies the authoritative total.
3. `src/features/checkout/razorpay.ts` opens Razorpay Checkout and sends its
   result to `/api/razorpay/verify`. The server validates the signature and fetches
   the provider payment to check captured status, INR currency and amount.
4. `/api/razorpay/webhook` independently verifies the raw-body signature for
   `payment.captured` and calls the idempotent database settlement function.
   Retries must not credit an order or membership twice. Late payments for
   expired reservations become `refund_pending`; staff must reconcile them.

## Configure staging first

Generate **Test Mode** keys in Razorpay Dashboard, Account & Settings → API Keys.
See [Razorpay's sandbox setup](https://github.com/razorpay/markdown-docs/blob/master/api/sandbox-setup.md).
Add these in Vercel project settings for Preview, restricted to the test branch:

```text
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=<test key secret>
RAZORPAY_WEBHOOK_SECRET=<separate webhook secret>
SUPABASE_SERVICE_ROLE_KEY=<demo project server key>
```

Only the public key ID may use `NEXT_PUBLIC_`. Keep secrets in hosting settings,
never chat or source. Redeploy after configuration. Provider callbacks must have
access to the test webhook endpoint while Vercel preview protection stays enabled;
a CLI-authenticated request does not prove Razorpay can reach it.

## Acceptance before live payments

- Capture a test payment and verify the order total, payment ID, stock and event history.
- Replay the same captured webhook and browser verification; settlement must occur once.
- Reject invalid signatures, altered amounts, other customers' orders and unpaid/uncaptured payments.
- Test dismissal, expiry, late capture and provider/network failures.
- Exercise an original-payment refund and reconcile it against Razorpay and the order.
  Existing wallet credits do not prove a provider refund; record the operational
  refund procedure before accepting prepaid customer orders.

The current demo preview has no Razorpay keys. Provider capture, webhook reachability
and refund acceptance remain pending. After these pass, configure live keys and
repeat deployment/configuration checks through the release process.

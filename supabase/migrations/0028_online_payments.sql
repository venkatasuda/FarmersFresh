-- =====================================================================
-- Farmers Fresh — Migration 0028: Online payment fields (Razorpay)
-- APPLIED to project bjevoybwufubtprkxbvb.
--
-- COD stays the default. These columns let an order also be paid online.
-- mark_order_paid() is called only from the server route AFTER it has verified
-- the Razorpay signature — it's revoked from every client role. See
-- docs/PAYMENTS.md for the (keys-only) activation.
--
-- Also: this file documents that place_order was recreated in migration 0028's
-- companion with p_use_credit + user_id capture (see 0027 header / live def).
-- =====================================================================

alter table public.orders
  add column if not exists is_paid boolean not null default false,
  add column if not exists razorpay_order_id text,
  add column if not exists razorpay_payment_id text,
  add column if not exists paid_at timestamptz;

-- mark_order_paid() body applied live; callable only by the service role.
revoke all on function public.mark_order_paid(uuid,text,text) from public, anon, authenticated;

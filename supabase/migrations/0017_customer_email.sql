-- =====================================================================
-- Farmers Fresh — Migration 0017: Optional customer email on orders
-- APPLIED to project bjevoybwufubtprkxbvb.
--
-- Adds an optional email to an order so the customer gets their confirmation
-- and order number by email as well as SMS/WhatsApp — not everyone reads SMS.
-- Phone stays the REQUIRED identity (COD, tracking, credit all key on phone);
-- email is a nice-to-have second channel.
--
-- Changes:
--   * orders.contact_email column
--   * place_order gains p_contact_email (defaulted → additive), validates the
--     format if given, and stores it. Full body re-created (Postgres can't add
--     a parameter in place); see the live definition or migration 0011/0006 for
--     the zone-check + rate-limit + staff-alert logic it preserves.
--   * enqueue_customer_notification() also queues an 'email' channel row when
--     the order has an email — for confirmation and every status change.
--
-- Verified: an order with an email queues email+sms+whatsapp for the customer;
-- an invalid email is refused ("That email address doesn't look right.").
--
-- The email is delivered by the send-notifications worker once RESEND_API_KEY
-- is set — same as the owner's alert emails. See docs/STOREFRONT.md.
-- =====================================================================

alter table public.orders add column if not exists contact_email text;

-- The full place_order and enqueue_customer_notification bodies were applied
-- live. To reproduce exactly:
--   select pg_get_functiondef('public.place_order(uuid,text,text,text,text,text,text,text,text,public.cart_line[],text)'::regprocedure);
--   select pg_get_functiondef('public.enqueue_customer_notification'::regproc);

revoke all on function public.place_order(uuid,text,text,text,text,text,text,text,text,public.cart_line[],text) from public;
grant execute on function public.place_order(uuid,text,text,text,text,text,text,text,text,public.cart_line[],text) to anon, authenticated;
revoke all on function public.enqueue_customer_notification() from public, anon, authenticated;

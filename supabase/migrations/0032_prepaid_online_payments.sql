-- =====================================================================
-- Migration 0032: Prepaid online payments (UPI / Card) with hold-until-paid
--
-- COD stays instant. For UPI/Card the order is created "pending_payment" and
-- HELD: stock is reserved so it can't be oversold during the payment window,
-- but the shop is NOT notified and the customer gets no "order placed" message
-- until the money is actually received (mark_order_paid). Abandoned payments
-- are swept back after 30 minutes, releasing stock and any wallet/coupon spend.
--
-- The full function bodies were applied live to project bjevoybwufubtprkxbvb.
-- See the live definitions of place_order / mark_order_paid /
-- enqueue_customer_notification / cancel_stale_unpaid_orders. Key points:
--   * orders_status_check now allows 'pending_payment'.
--   * orders_payment_method_check now allows 'upi' and 'card'.
--   * place_order gains p_payment_method (default 'cod'); online orders get
--     status 'pending_payment' and skip the staff notification.
--   * mark_order_paid flips pending_payment -> placed and only THEN notifies
--     the shop; it is idempotent (a repeated verify/webhook does nothing).
--   * enqueue_customer_notification suppresses the "order placed" message for a
--     held online order and sends it when is_paid flips true.
--   * cancel_stale_unpaid_orders() (cron 'sweep-unpaid-orders', every 5 min)
--     releases stock, refunds wallet credit, returns coupon use, and cancels
--     online orders left unpaid for 30 minutes.
-- =====================================================================

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status = any (array[
    'pending_payment','placed','confirmed','packed',
    'out_for_delivery','delivered','cancelled']));

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method = any (array['cod','upi_on_delivery','upi','card']));

-- place_order(..., p_payment_method text default 'cod') — full body applied live.
revoke all on function public.place_order(uuid,text,text,text,text,text,text,text,text,cart_line[],text,text,boolean,text) from public;
grant execute on function public.place_order(uuid,text,text,text,text,text,text,text,text,cart_line[],text,text,boolean,text) to anon, authenticated;

-- mark_order_paid — confirms a held order and notifies the shop; idempotent.
revoke all on function public.mark_order_paid(uuid,text,text) from public, anon, authenticated;

-- cancel_stale_unpaid_orders — swept by cron 'sweep-unpaid-orders' every 5 min.
revoke all on function public.cancel_stale_unpaid_orders() from public, anon, authenticated;

-- =====================================================================
-- Migration 0035: Web-push subscriptions + back-in-stock alerts
--
-- Two new customer touchpoints, both delivered through the existing outbox:
--   * push_subscriptions  — a device's Web Push endpoint, so we can notify a
--     logged-in customer even with the app closed.
--   * stock_alerts        — "tell me when this is back". When a restock makes a
--     sold-out product available again, every waiting customer is notified once
--     (email / SMS / WhatsApp / push, per the contact they left).
--
-- Applied live to project bjevoybwufubtprkxbvb. Highlights:
--   * notifications.channel now allows 'push'.
--   * save_push_subscription / delete_push_subscription — manage a device sub.
--   * watch_stock(product, email?, phone?) — join the back-in-stock list.
--   * notify_on_restock() trigger on stock_movements — on a positive movement
--     that crosses 0 -> in-stock, enqueues one notification per waiter and
--     marks them notified (no repeats).
-- =====================================================================

alter table public.notifications drop constraint if exists notifications_channel_check;
alter table public.notifications add constraint notifications_channel_check
  check (channel = any (array['email','sms','whatsapp','push']));

-- push_subscriptions + RLS (own) ; managed via the RPCs below.
revoke all on function public.save_push_subscription(text,text,text) from public, anon;
grant execute on function public.save_push_subscription(text,text,text) to authenticated;
revoke all on function public.delete_push_subscription(text) from public, anon;
grant execute on function public.delete_push_subscription(text) to authenticated;

-- stock_alerts + watch_stock (anon + authenticated) + notify_on_restock trigger.
revoke all on function public.watch_stock(uuid,text,text) from public;
grant execute on function public.watch_stock(uuid,text,text) to anon, authenticated;
revoke all on function public.notify_on_restock() from public, anon, authenticated;

-- Full table definitions, policies and function bodies were applied live; see
-- pg_get_functiondef / pg_get_constraintdef for the exact source.

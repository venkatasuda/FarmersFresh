-- =====================================================================
-- Farmers Fresh — Migration 0018: Realtime on orders
-- APPLIED to project bjevoybwufubtprkxbvb.
--
-- Puts `orders` on the Realtime publication so the staff order board receives
-- inserts and status changes as they happen — no polling, no reload.
--
-- SECURITY: Realtime "postgres_changes" enforces the SAME RLS as a query. A
-- staff member's browser subscription carries their JWT, so they only receive
-- changes their `orders_read` policy already permits (their org + locations).
-- The public storefront has NO select policy on orders (verified: 0 anon
-- SELECT policies), so a customer subscription receives nothing — which is why
-- live customer tracking polls the security-definer track_order() instead.
--
-- REPLICA IDENTITY FULL so UPDATE events carry the whole row (a status change
-- needs the new status, and RLS filtering on updates needs the columns).
-- =====================================================================

alter table public.orders replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    execute 'alter publication supabase_realtime add table public.orders';
  end if;
end $$;

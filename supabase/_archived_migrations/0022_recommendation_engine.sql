-- =====================================================================
-- Farmers Fresh — Migration 0022: Recommendation engine
-- APPLIED to project bjevoybwufubtprkxbvb.
--
-- Two ideas working together, like the "frequently bought together" engines
-- at Amazon/BigBasket:
--
--   1. MARKET-BASKET (collaborative): products that appear in the SAME orders
--      as the target. The real signal — learns from what customers actually
--      buy together, no rules. Empty on day one, sharper with every order.
--
--   2. INGREDIENT AFFINITY (content cold-start): a curated DEPARTMENT map —
--      mutton↔spices+oil, rice↔dal+ghee, veg↔spices — so suggestions are
--      sensible from the first visit, before any order history exists.
--
-- Co-purchase is weighted ×100 vs affinity ×1, so real data takes over
-- automatically. Out-of-stock / unpublished items are never suggested.
--
-- Functions (bodies applied live — see pg_get_functiondef):
--   product_department(uuid)               → a product's department slug
--   in_stock_products(org)                 → buyable-now set
--   frequently_bought_together(uuid, int)  → product-page "Goes well with"
--   cart_recommendations(uuid[], int)      → cart "Complete your order"
--
-- Verified: Leg → spices + more meat; [Leg + Turmeric] basket → coriander,
-- cumin, garam masala, chilli, mustard (curry complements).
-- =====================================================================

create table if not exists public.category_affinity (
  org_id    uuid not null references public.organizations(id) on delete cascade,
  from_slug text not null,
  to_slug   text not null,
  weight    numeric not null default 1,
  primary key (org_id, from_slug, to_slug)
);

alter table public.category_affinity enable row level security;
drop policy if exists affinity_read on public.category_affinity;
create policy affinity_read on public.category_affinity for select to anon, authenticated using (true);
drop policy if exists affinity_owner on public.category_affinity;
create policy affinity_owner on public.category_affinity for all to authenticated
  using (org_id = public.current_org_id() and public.is_org_owner())
  with check (org_id = public.current_org_id() and public.is_org_owner());

-- Seed and full function bodies were applied live. Grants:
revoke all on function public.frequently_bought_together(uuid,int) from public;
grant execute on function public.frequently_bought_together(uuid,int) to anon, authenticated;
revoke all on function public.cart_recommendations(uuid[],int) from public;
grant execute on function public.cart_recommendations(uuid[],int) to anon, authenticated;

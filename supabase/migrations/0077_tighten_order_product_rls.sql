-- =====================================================================
-- Migration 0077: P0/P1 fix — DB permissions must match UI permissions
--
-- Before: any authenticated org member could UPDATE any product (prices) and
-- any order field (is_paid, total, status) directly via the API, bypassing the
-- owner-only / role-gated UI. SECURITY DEFINER RPCs (payments, markdown,
-- receive, cancel, claim) run as the table owner and BYPASS these grants, so
-- the legitimate flows keep working — only the direct-client hole is closed.
-- Applied live to project bjevoybwufubtprkxbvb.
-- =====================================================================

-- PRODUCTS — catalogue writes are owner-only (matches the owner-only UI).
drop policy if exists prod_write on public.products;
create policy prod_write on public.products for insert to authenticated
  with check (org_id = public.current_org_id() and public.is_org_owner());

drop policy if exists prod_update on public.products;
create policy prod_update on public.products for update to authenticated
  using (org_id = public.current_org_id() and public.is_org_owner())
  with check (org_id = public.current_org_id() and public.is_org_owner());

revoke update, insert on public.products from anon;

-- ORDERS — scope to the member's location, and to fulfilment columns only.
drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders for update to authenticated
  using (org_id = public.current_org_id() and (public.is_org_owner() or public.has_location(location_id)))
  with check (org_id = public.current_org_id() and (public.is_org_owner() or public.has_location(location_id)));

-- Money, payment, assignment and totals are written ONLY by definer RPCs.
revoke update on public.orders from authenticated, anon;
grant update (status, confirmed_at, delivered_at, updated_at) on public.orders to authenticated;

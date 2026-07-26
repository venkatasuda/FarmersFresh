-- =====================================================================
-- Migration 0030: "Buy it again" — the customer's past-purchased products
--
-- Returns the DISTINCT products the logged-in customer has ordered before
-- (matched by their account email/phone), that are still published and in
-- stock — as a list of product ids for the "buy it again" row. Scoped to the
-- caller's own history.
-- =====================================================================

create or replace function public.my_reorder_products(p_limit int default 12)
returns setof uuid
language sql stable security definer set search_path = public as $$
  with me as (
    select nullif(right(regexp_replace(coalesce(u.phone,''), '\D','','g'),10),'') as phone,
           lower(nullif(trim(coalesce(u.email,'')),'')) as email
    from auth.users u where u.id = auth.uid()
  ),
  mine as (
    select distinct oi.product_id, max(o.placed_at) as last_at
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    join me on ((me.phone is not null and right(o.contact_phone,10) = me.phone)
             or (me.email is not null and lower(o.contact_email) = me.email))
    where o.status <> 'cancelled'
    group by oi.product_id
  )
  select m.product_id
  from mine m
  join public.in_stock_products(public.storefront_org_id()) s on s.product_id = m.product_id
  order by m.last_at desc
  limit p_limit;
$$;

revoke all on function public.my_reorder_products(int) from public, anon;
grant execute on function public.my_reorder_products(int) to authenticated;

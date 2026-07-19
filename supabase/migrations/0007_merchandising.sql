-- =====================================================================
-- Farmers Fresh — Migration 0007: Merchandising
-- APPLIED to project bjevoybwufubtprkxbvb.
--
-- The grocery-storefront pattern (Jamoona, BigBasket, Licious) leans on
-- three things this schema didn't have:
--   * a struck-through "was" price, so a discount reads as a discount
--   * a short badge ("Bestseller", "Today's cut")
--   * categories that can carry their own landing page
--
-- compare_at_price is CHECKED to be strictly higher than sale_price. A
-- "discount" where the crossed-out number is lower than what you charge is
-- a dark pattern, and in India it is also a Legal Metrology problem. The
-- database refuses rather than trusting whoever fills the form.
-- =====================================================================

alter table public.products
  add column if not exists compare_at_price numeric(12,2) check (compare_at_price >= 0),
  add column if not exists badge text,
  add column if not exists category_slug text,
  add column if not exists category_sort integer not null default 100;

alter table public.products drop constraint if exists products_compare_price_sane;
alter table public.products add constraint products_compare_price_sane check (
  compare_at_price is null
  or sale_price is null
  or compare_at_price > sale_price
);

create index if not exists idx_products_category
  on public.products(org_id, category_slug, category_sort);

update public.products
   set category_slug = lower(regexp_replace(category, '[^a-zA-Z0-9]+', '-', 'g'))
 where category is not null and category_slug is null;

-- Public category list, for the nav rail and /collections/[slug].
create or replace function public.catalogue_categories()
returns table (slug text, name text, product_count bigint)
language sql stable security definer set search_path = public as $$
  select p.category_slug, min(p.category), count(*)
  from public.products p
  join public.organizations o on o.id = p.org_id
  where p.is_published and p.is_active and o.storefront_enabled
    and p.category_slug is not null
  group by p.category_slug
  order by min(p.category_sort), min(p.category);
$$;

revoke all on function public.catalogue_categories() from public;
grant execute on function public.catalogue_categories() to anon, authenticated;

-- =====================================================================
-- Seed merchandising (placeholders — the owner must set real prices)
-- =====================================================================
-- update public.products set badge = 'Bestseller', compare_at_price = 950 where slug = 'leg';
-- update public.products set badge = 'Best value', compare_at_price = 820 where slug = 'whole';
-- update public.products set badge = 'Today''s cut'                        where slug = 'mince';

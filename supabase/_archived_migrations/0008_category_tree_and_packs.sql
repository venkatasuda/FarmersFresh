-- =====================================================================
-- Farmers Fresh — Migration 0008: Category tree + packaged goods
-- APPLIED to project bjevoybwufubtprkxbvb.
--
-- SCOPE CHANGE. Farmers Fresh is a full Indian grocery store — rice, dal,
-- spices, snacks, oil — with meat (mutton, chicken, eggs, fish) as ONE
-- department, not the whole business.
--
-- Two things the meat-only schema got wrong for groceries:
--
-- 1. CATEGORIES. A flat `category` text column cannot express
--    "Rice → Basmati Rice". Every grocery storefront needs two levels, so
--    this is a proper self-referencing table with a depth guard.
--
-- 2. UNITS. Meat is sold LOOSE by weight: 1.5 kg of leg, stepping 500 g.
--    Groceries are sold as PACKS: a 5 kg bag of atta, a 100 g packet of
--    turmeric, a dozen eggs. Ordering "0.5" of a spice packet is nonsense.
--    A product is now either weight-sold (pack_size null) or pack-sold, and
--    the storefront's quantity stepper switches behaviour on that field.
--
--    pack_size + pack_unit also give a comparable unit price
--    ("₹120 · ₹240/kg"), which is how a customer judges a 500 g pack against
--    a 1 kg one without doing arithmetic in the aisle.
-- =====================================================================

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  parent_id   uuid references public.categories(id) on delete cascade,
  slug        text not null,
  name        text not null,
  icon        text,                       -- emoji: cheap, renders everywhere
  sort_order  integer not null default 100,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, slug)
);
create index if not exists idx_categories_parent on public.categories(parent_id, sort_order);
create index if not exists idx_categories_org on public.categories(org_id, sort_order);

drop trigger if exists trg_categories_updated on public.categories;
create trigger trg_categories_updated before update on public.categories
  for each row execute function public.set_updated_at();

-- Two levels only, and nothing may parent itself. Enforced in the database
-- because a cycle here would hang the nav query, not just look wrong.
create or replace function public.check_category_depth()
returns trigger language plpgsql set search_path = public as $$
declare v_grandparent uuid;
begin
  if new.parent_id = new.id then
    raise exception 'A category cannot be its own parent.';
  end if;
  if new.parent_id is not null then
    select parent_id into v_grandparent from public.categories where id = new.parent_id;
    if v_grandparent is not null then
      raise exception 'Categories are limited to two levels.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_category_depth on public.categories;
create trigger trg_category_depth before insert or update on public.categories
  for each row execute function public.check_category_depth();

alter table public.products
  add column if not exists category_id uuid references public.categories(id) on delete set null,
  add column if not exists pack_size numeric(12,3) check (pack_size is null or pack_size > 0),
  add column if not exists pack_unit text check (pack_unit in ('g','kg','ml','l','piece','dozen')),
  add column if not exists brand text;

create index if not exists idx_products_category_id
  on public.products(org_id, category_id, sort_order);

alter table public.products drop constraint if exists products_pack_consistent;
alter table public.products add constraint products_pack_consistent check (
  (pack_size is null and pack_unit is null)
  or (pack_size is not null and pack_unit is not null)
);

alter table public.categories enable row level security;

drop policy if exists cat_public_read on public.categories;
create policy cat_public_read on public.categories for select to anon
  using (is_active and public.is_storefront_org(org_id));

drop policy if exists cat_staff_read on public.categories;
create policy cat_staff_read on public.categories for select to authenticated
  using (org_id = public.current_org_id());

drop policy if exists cat_owner_write on public.categories;
create policy cat_owner_write on public.categories for all to authenticated
  using (org_id = public.current_org_id() and public.is_org_owner())
  with check (org_id = public.current_org_id() and public.is_org_owner());

-- =====================================================================
-- Public catalogue functions
-- =====================================================================

drop function if exists public.catalogue_categories();

-- Both levels in one call with a parent pointer, so the storefront builds
-- the menu without N+1 queries. Counts are RECURSIVE — a department shows
-- the total across its children, which is what "Rice (4)" should mean.
create function public.catalogue_categories()
returns table (
  id uuid, parent_id uuid, slug text, name text, icon text,
  sort_order int, product_count bigint
)
language sql stable security definer set search_path = public as $$
  with live as (
    select p.category_id, count(*) as n
    from public.products p
    join public.organizations o on o.id = p.org_id
    where p.is_published and p.is_active and o.storefront_enabled
    group by p.category_id
  )
  select c.id, c.parent_id, c.slug, c.name, c.icon, c.sort_order,
         coalesce(direct.n, 0) + coalesce(kids.n, 0) as product_count
  from public.categories c
  join public.organizations o on o.id = c.org_id
  left join live direct on direct.category_id = c.id
  left join lateral (
    select sum(l.n) as n
    from public.categories child
    join live l on l.category_id = child.id
    where child.parent_id = c.id
  ) kids on true
  where c.is_active and o.storefront_enabled
  order by c.sort_order, c.name;
$$;

revoke all on function public.catalogue_categories() from public;
grant execute on function public.catalogue_categories() to anon, authenticated;

-- Products in a category, INCLUDING its child categories when given a
-- department slug. Without the recursion, clicking "Rice" returns nothing —
-- every rice product lives in a subcategory, not the department itself.
create or replace function public.catalogue_by_category(p_slug text)
returns table (product_id uuid)
language sql stable security definer set search_path = public as $$
  select p.id
  from public.products p
  join public.organizations o on o.id = p.org_id
  join public.categories c on c.id = p.category_id
  left join public.categories parent on parent.id = c.parent_id
  where p.is_published and p.is_active and o.storefront_enabled
    and (c.slug = p_slug or parent.slug = p_slug)
  order by c.sort_order, p.sort_order, p.name;
$$;

revoke all on function public.catalogue_by_category(text) from public;
grant execute on function public.catalogue_by_category(text) to anon, authenticated;

-- Comparable unit price, kept in SQL so the storefront and any future report
-- agree on the number.
create or replace function public.unit_price(
  p_sale numeric, p_size numeric, p_unit text
) returns numeric language sql immutable as $$
  select case
    when p_sale is null or p_size is null or p_size <= 0 then null
    when p_unit = 'g'  then round(p_sale / (p_size / 1000.0), 2)
    when p_unit = 'kg' then round(p_sale / p_size, 2)
    when p_unit = 'ml' then round(p_sale / (p_size / 1000.0), 2)
    when p_unit = 'l'  then round(p_sale / p_size, 2)
    when p_unit = 'dozen' then round(p_sale / (p_size * 12), 2)
    when p_unit = 'piece' then round(p_sale / p_size, 2)
    else null
  end;
$$;

-- =====================================================================
-- Seeding: see docs/STOREFRONT.md. The category tree and a starter
-- catalogue were seeded separately; all prices are PLACEHOLDERS.
-- =====================================================================

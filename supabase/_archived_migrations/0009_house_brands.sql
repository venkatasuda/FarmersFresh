-- =====================================================================
-- Farmers Fresh — Migration 0009: House brands
-- APPLIED to project bjevoybwufubtprkxbvb.
--
-- CORRECTION. Farmers Fresh is not a reseller. It sells its OWN brand:
-- meat, eggs and produce from its own farms under the master brand, plus a
-- small number of SUB-BRANDS for packed goods. It does not stock Aashirvaad,
-- Amul, India Gate and the rest — the 0008 seed was wrong about what this
-- business is, and those lines were retired.
--
-- Why a table rather than the `brand` text column:
--   * A sub-brand carries its own promise ("milled and packed by us"), and
--     that copy belongs in one place, not repeated on forty product rows.
--   * Renaming a sub-brand becomes one UPDATE, not a find-and-replace.
--   * `is_house_brand` leaves the door open for the occasional bought-in
--     line without pretending it is yours — which matters, because "our own"
--     is the whole promise and has to stay literally true.
--
-- CONSEQUENCE FOR THE STOREFRONT: there is no "shop by brand" filter. Brand
-- facets exist to help a customer choose between rival makers; here there is
-- one maker. The brand shows as quiet context on a card and as a promise on
-- the product page.
-- =====================================================================

create table if not exists public.brands (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  slug           text not null,
  name           text not null,
  tagline        text,
  description    text,
  is_house_brand boolean not null default true,
  is_primary     boolean not null default false,
  sort_order     integer not null default 100,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (org_id, slug)
);
create index if not exists idx_brands_org on public.brands(org_id, sort_order);

drop trigger if exists trg_brands_updated on public.brands;
create trigger trg_brands_updated before update on public.brands
  for each row execute function public.set_updated_at();

-- Exactly one primary brand per org. Two "main" brands is a branding
-- decision that has gone wrong, and the database may as well say so.
create unique index if not exists uq_one_primary_brand
  on public.brands(org_id) where is_primary;

alter table public.products
  add column if not exists brand_id uuid references public.brands(id) on delete set null;

create index if not exists idx_products_brand on public.products(org_id, brand_id);

alter table public.brands enable row level security;

drop policy if exists brand_public_read on public.brands;
create policy brand_public_read on public.brands for select to anon
  using (is_active and public.is_storefront_org(org_id));

drop policy if exists brand_staff_read on public.brands;
create policy brand_staff_read on public.brands for select to authenticated
  using (org_id = public.current_org_id());

drop policy if exists brand_owner_write on public.brands;
create policy brand_owner_write on public.brands for all to authenticated
  using (org_id = public.current_org_id() and public.is_org_owner())
  with check (org_id = public.current_org_id() and public.is_org_owner());

-- =====================================================================
-- Seed — SUB-BRAND NAMES ARE PLACEHOLDERS.
-- The structure (one master brand + product-line sub-brands) is the
-- decision that matters. The words are the owner's to choose; renaming is
-- one UPDATE per row and nothing else in the app hardcodes them.
-- =====================================================================
-- insert into public.brands (org_id, slug, name, tagline, is_primary, sort_order) values
--   ('<org>', 'farmers-fresh', 'Farmers Fresh',        'From our farms, to your kitchen', true,  10),
--   ('<org>', 'ff-pantry',     'Farmers Fresh Pantry', 'Milled and packed by us',         false, 20),
--   ('<org>', 'ff-masala',     'Farmers Fresh Masala', 'Ground in small batches',         false, 30),
--   ('<org>', 'ff-kitchen',    'Farmers Fresh Kitchen','Made in our kitchen',             false, 40);

-- =====================================================================
-- A NOTE ON RETIRING PRODUCTS
--
-- The third-party lines could NOT be deleted: `stock_movements` is
-- append-only (trigger `block_mutation`) and holds their history, and the
-- foreign key is ON DELETE RESTRICT. That is the ledger working as intended.
--
-- The correct move — and what a real shop does when discontinuing a line —
-- is to write the stock down to zero with an opposing `adjustment` entry and
-- set is_active = false. History stays readable: these products existed,
-- carried stock, and were withdrawn.
--
--   insert into public.stock_movements
--     (org_id, location_id, product_id, delta, reason, note)
--   values (org, loc, product, -on_hand, 'adjustment', 'Line discontinued');
--
--   update public.products set is_published = false, is_active = false
--    where id = product;
-- =====================================================================

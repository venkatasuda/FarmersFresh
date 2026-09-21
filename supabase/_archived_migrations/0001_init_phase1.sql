-- =====================================================================
-- Farmers Fresh — Phase 1 Schema (Money Side + Foundation)
-- Target: Supabase (PostgreSQL 15+)
-- Mandate: multi-tenant from day one, State→City→Location hierarchy,
--          immutable event log, row-level security, 15-year durable core.
--
-- Run this in the Supabase SQL editor (or as migration 0001).
-- Idempotent-ish: uses IF NOT EXISTS where practical.
-- =====================================================================

-- ---------- Extensions ----------
create extension if not exists pgcrypto;   -- gen_random_uuid()

-- =====================================================================
-- SECTION 0 — Shared helper functions
-- =====================================================================

-- keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- append-only guard (used by the event log)
create or replace function public.block_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'This table is append-only; % is not allowed', tg_op;
end $$;

-- =====================================================================
-- SECTION 1 — Tenancy + Geography
--   organizations = the tenant boundary (one now, thousands later).
--   states / cities = shared reference geography for clean rollups.
--   locations = farms (produce) and stores (sell) under an org.
-- =====================================================================

create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.states (
  id     uuid primary key default gen_random_uuid(),
  name   text not null,
  code   text,
  unique (name)
);

create table if not exists public.cities (
  id        uuid primary key default gen_random_uuid(),
  state_id  uuid not null references public.states(id) on delete restrict,
  name      text not null,
  unique (state_id, name)
);
create index if not exists idx_cities_state on public.cities(state_id);

create table if not exists public.locations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  city_id     uuid references public.cities(id) on delete set null,
  type        text not null check (type in ('farm','store')),
  name        text not null,
  code        text,                       -- short human code, e.g. STG-01
  address     text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_locations_org  on public.locations(org_id);
create index if not exists idx_locations_city on public.locations(city_id);
create index if not exists idx_locations_type on public.locations(org_id, type);
create trigger trg_locations_updated before update on public.locations
  for each row execute function public.set_updated_at();

-- =====================================================================
-- SECTION 2 — Users, membership, access
--   profiles = 1:1 with Supabase auth.users, carries the tenant (org).
--   memberships = which locations a user can touch, and in what role.
--   is_owner on the profile = org-wide access (sees all locations).
-- =====================================================================

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  org_id      uuid not null references public.organizations(id) on delete cascade,
  full_name   text,
  is_owner    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_profiles_org on public.profiles(org_id);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

create table if not exists public.memberships (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  location_id  uuid not null references public.locations(id) on delete cascade,
  role         text not null check (role in ('owner','manager','staff','accountant')),
  created_at   timestamptz not null default now(),
  unique (user_id, location_id)
);
create index if not exists idx_memberships_user on public.memberships(user_id);
create index if not exists idx_memberships_loc  on public.memberships(location_id);

-- =====================================================================
-- SECTION 3 — RLS helper functions (security definer)
--   These read the caller's identity (auth.uid) and answer:
--   which org am I in? am I an owner? can I access this location?
-- =====================================================================

create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_org_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_owner from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.has_location(loc uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_org_owner()
      or exists (
        select 1 from public.memberships m
        where m.user_id = auth.uid() and m.location_id = loc
      );
$$;

-- =====================================================================
-- SECTION 4 — Product catalog (cuts) and basic meat stock
--   products = the sellable cuts (Leg, Chops, Mince, Whole, Offal...).
--   stock_items = simple current stock at a store (basic for Phase 1;
--                 full FIFO/lot-derived stock is Phase 1.5+).
-- =====================================================================

create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  unit        text not null default 'kg' check (unit in ('kg','piece')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, name)
);
create index if not exists idx_products_org on public.products(org_id);
create trigger trg_products_updated before update on public.products
  for each row execute function public.set_updated_at();

create table if not exists public.stock_items (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  location_id  uuid not null references public.locations(id) on delete cascade,
  product_id   uuid not null references public.products(id) on delete restrict,
  quantity     numeric(12,3) not null default 0 check (quantity >= 0),
  lot_code     text,
  expiry_date  date,
  status       text not null default 'in_stock'
               check (status in ('in_stock','sold_out','wasted')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_stock_org_loc on public.stock_items(org_id, location_id);
create index if not exists idx_stock_product on public.stock_items(product_id);
create index if not exists idx_stock_expiry  on public.stock_items(expiry_date);
create trigger trg_stock_updated before update on public.stock_items
  for each row execute function public.set_updated_at();

-- =====================================================================
-- SECTION 5 — Customers (the credit relationship lives here)
-- =====================================================================

create table if not exists public.customers (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  location_id  uuid not null references public.locations(id) on delete restrict, -- home store
  name         text not null,
  phone        text,
  type         text not null default 'regular'
               check (type in ('walk_in','regular','restaurant','bulk')),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_customers_org_loc on public.customers(org_id, location_id);
create index if not exists idx_customers_phone    on public.customers(phone);
create trigger trg_customers_updated before update on public.customers
  for each row execute function public.set_updated_at();

-- =====================================================================
-- SECTION 6 — Sales, line items, payments
--   payments are the single source of truth for money received.
--   sales.amount_paid + payment_status are DENORMALIZED and kept
--   correct by a trigger, so they can never drift from the payments.
-- =====================================================================

create table if not exists public.sales (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  location_id    uuid not null references public.locations(id) on delete restrict,
  customer_id    uuid references public.customers(id) on delete set null, -- null = anonymous cash sale
  sale_date      timestamptz not null default now(),
  total          numeric(12,2) not null default 0 check (total >= 0),
  amount_paid    numeric(12,2) not null default 0 check (amount_paid >= 0),
  payment_status text not null default 'credit'
                 check (payment_status in ('paid','partial','credit')),
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_sales_org_loc  on public.sales(org_id, location_id);
create index if not exists idx_sales_customer on public.sales(customer_id);
create index if not exists idx_sales_date     on public.sales(sale_date);
create index if not exists idx_sales_status   on public.sales(payment_status);
create trigger trg_sales_updated before update on public.sales
  for each row execute function public.set_updated_at();

create table if not exists public.sale_items (
  id          uuid primary key default gen_random_uuid(),
  sale_id     uuid not null references public.sales(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete restrict,
  quantity    numeric(12,3) not null check (quantity > 0),
  unit_price  numeric(12,2) not null check (unit_price >= 0),
  line_total  numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored,
  created_at  timestamptz not null default now()
);
create index if not exists idx_sale_items_sale    on public.sale_items(sale_id);
create index if not exists idx_sale_items_product on public.sale_items(product_id);

create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  location_id  uuid not null references public.locations(id) on delete restrict,
  sale_id      uuid references public.sales(id) on delete set null,      -- optional: payment against a sale
  customer_id  uuid references public.customers(id) on delete set null,  -- set for all credit customers
  amount       numeric(12,2) not null check (amount > 0),
  method       text not null default 'cash'
               check (method in ('cash','upi','card','bank_transfer','other')),
  paid_at      timestamptz not null default now(),
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_payments_org_loc  on public.payments(org_id, location_id);
create index if not exists idx_payments_sale      on public.payments(sale_id);
create index if not exists idx_payments_customer  on public.payments(customer_id);

-- keep sales.amount_paid + payment_status correct from payments
create or replace function public.recalc_sale_payment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_sale uuid;
  v_total numeric(12,2);
  v_paid  numeric(12,2);
begin
  v_sale := coalesce(new.sale_id, old.sale_id);
  if v_sale is null then
    return coalesce(new, old);
  end if;

  select total into v_total from public.sales where id = v_sale;
  select coalesce(sum(amount), 0) into v_paid from public.payments where sale_id = v_sale;

  update public.sales
     set amount_paid    = v_paid,
         payment_status = case
                            when v_paid >= v_total then 'paid'
                            when v_paid > 0        then 'partial'
                            else 'credit'
                          end,
         updated_at     = now()
   where id = v_sale;

  return coalesce(new, old);
end $$;

create trigger trg_payment_recalc
  after insert or update or delete on public.payments
  for each row execute function public.recalc_sale_payment();

-- =====================================================================
-- SECTION 7 — Immutable event log (audit + future-AI fuel)
--   Every meaningful action is appended here, forever, append-only.
--   bigint identity gives natural ordering; payload is a jsonb snapshot.
-- =====================================================================

create table if not exists public.events (
  id           bigint generated always as identity primary key,
  org_id       uuid not null references public.organizations(id) on delete cascade,
  location_id  uuid references public.locations(id) on delete set null,
  actor_id     uuid references public.profiles(id) on delete set null,
  event_type   text not null,             -- e.g. 'sale.created','payment.recorded'
  entity_type  text,                      -- e.g. 'sale','payment','customer'
  entity_id    uuid,
  payload      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists idx_events_org      on public.events(org_id);
create index if not exists idx_events_type      on public.events(event_type);
create index if not exists idx_events_entity    on public.events(entity_type, entity_id);
create index if not exists idx_events_created   on public.events(created_at);

-- enforce append-only at the database level
create trigger trg_events_no_update
  before update or delete on public.events
  for each row execute function public.block_mutation();

-- =====================================================================
-- SECTION 8 — Reporting views (RLS-aware via security_invoker)
-- =====================================================================

-- outstanding balance per customer (billed - paid), the debtor ledger
create or replace view public.customer_balances
with (security_invoker = true) as
select
  c.id           as customer_id,
  c.org_id,
  c.location_id,
  c.name,
  c.phone,
  coalesce(s.total_billed, 0)                                  as total_billed,
  coalesce(p.total_paid, 0)                                    as total_paid,
  coalesce(s.total_billed, 0) - coalesce(p.total_paid, 0)      as outstanding
from public.customers c
left join (
  select customer_id, sum(total) as total_billed
  from public.sales where customer_id is not null group by customer_id
) s on s.customer_id = c.id
left join (
  select customer_id, sum(amount) as total_paid
  from public.payments where customer_id is not null group by customer_id
) p on p.customer_id = c.id;

-- daily sales summary per location (for dashboards / state-city rollup joins)
create or replace view public.location_daily_sales
with (security_invoker = true) as
select
  s.org_id,
  s.location_id,
  date_trunc('day', s.sale_date)::date as day,
  count(*)                              as sale_count,
  sum(s.total)                          as total_billed,
  sum(s.amount_paid)                    as total_collected,
  sum(s.total - s.amount_paid)          as outstanding
from public.sales s
group by s.org_id, s.location_id, date_trunc('day', s.sale_date)::date;

-- =====================================================================
-- SECTION 9 — Enable Row-Level Security + policies
-- =====================================================================

alter table public.organizations enable row level security;
alter table public.locations     enable row level security;
alter table public.profiles       enable row level security;
alter table public.memberships    enable row level security;
alter table public.products       enable row level security;
alter table public.stock_items    enable row level security;
alter table public.customers      enable row level security;
alter table public.sales          enable row level security;
alter table public.sale_items     enable row level security;
alter table public.payments       enable row level security;
alter table public.events         enable row level security;
alter table public.states         enable row level security;
alter table public.cities         enable row level security;

-- Geography reference: any authenticated user may read
create policy states_read on public.states for select to authenticated using (true);
create policy cities_read on public.cities for select to authenticated using (true);

-- Organizations: members read own org; owners update
create policy org_read   on public.organizations for select to authenticated
  using (id = public.current_org_id());
create policy org_update on public.organizations for update to authenticated
  using (id = public.current_org_id() and public.is_org_owner())
  with check (id = public.current_org_id() and public.is_org_owner());

-- Locations: members read locations in their org; owners write
create policy loc_read   on public.locations for select to authenticated
  using (org_id = public.current_org_id());
create policy loc_write  on public.locations for all to authenticated
  using (org_id = public.current_org_id() and public.is_org_owner())
  with check (org_id = public.current_org_id() and public.is_org_owner());

-- Profiles: read profiles in own org; users update their own row
create policy prof_read      on public.profiles for select to authenticated
  using (org_id = public.current_org_id());
create policy prof_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Memberships: read within org; owners manage
create policy mem_read  on public.memberships for select to authenticated
  using (org_id = public.current_org_id());
create policy mem_write on public.memberships for all to authenticated
  using (org_id = public.current_org_id() and public.is_org_owner())
  with check (org_id = public.current_org_id() and public.is_org_owner());

-- Products: read within org; members create/update; owners delete
create policy prod_read   on public.products for select to authenticated
  using (org_id = public.current_org_id());
create policy prod_write  on public.products for insert to authenticated
  with check (org_id = public.current_org_id());
create policy prod_update on public.products for update to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
create policy prod_delete on public.products for delete to authenticated
  using (org_id = public.current_org_id() and public.is_org_owner());

-- Location-scoped tables share one pattern:
--   read/write if the row's location is accessible to the caller.

-- Stock
create policy stock_read   on public.stock_items for select to authenticated
  using (org_id = public.current_org_id() and public.has_location(location_id));
create policy stock_write  on public.stock_items for insert to authenticated
  with check (org_id = public.current_org_id() and public.has_location(location_id));
create policy stock_update on public.stock_items for update to authenticated
  using (org_id = public.current_org_id() and public.has_location(location_id))
  with check (org_id = public.current_org_id() and public.has_location(location_id));
create policy stock_delete on public.stock_items for delete to authenticated
  using (org_id = public.current_org_id() and public.is_org_owner());

-- Customers
create policy cust_read   on public.customers for select to authenticated
  using (org_id = public.current_org_id() and public.has_location(location_id));
create policy cust_write  on public.customers for insert to authenticated
  with check (org_id = public.current_org_id() and public.has_location(location_id));
create policy cust_update on public.customers for update to authenticated
  using (org_id = public.current_org_id() and public.has_location(location_id))
  with check (org_id = public.current_org_id() and public.has_location(location_id));
create policy cust_delete on public.customers for delete to authenticated
  using (org_id = public.current_org_id() and public.is_org_owner());

-- Sales
create policy sale_read   on public.sales for select to authenticated
  using (org_id = public.current_org_id() and public.has_location(location_id));
create policy sale_write  on public.sales for insert to authenticated
  with check (org_id = public.current_org_id() and public.has_location(location_id));
create policy sale_update on public.sales for update to authenticated
  using (org_id = public.current_org_id() and public.has_location(location_id))
  with check (org_id = public.current_org_id() and public.has_location(location_id));
create policy sale_delete on public.sales for delete to authenticated
  using (org_id = public.current_org_id() and public.is_org_owner());

-- Sale items: scoped through their parent sale
create policy si_read  on public.sale_items for select to authenticated
  using (exists (
    select 1 from public.sales s
    where s.id = sale_items.sale_id
      and s.org_id = public.current_org_id()
      and public.has_location(s.location_id)));
create policy si_write on public.sale_items for all to authenticated
  using (exists (
    select 1 from public.sales s
    where s.id = sale_items.sale_id
      and s.org_id = public.current_org_id()
      and public.has_location(s.location_id)))
  with check (exists (
    select 1 from public.sales s
    where s.id = sale_items.sale_id
      and s.org_id = public.current_org_id()
      and public.has_location(s.location_id)));

-- Payments
create policy pay_read   on public.payments for select to authenticated
  using (org_id = public.current_org_id() and public.has_location(location_id));
create policy pay_write  on public.payments for insert to authenticated
  with check (org_id = public.current_org_id() and public.has_location(location_id));
create policy pay_delete on public.payments for delete to authenticated
  using (org_id = public.current_org_id() and public.is_org_owner());

-- Events: read within org; append within org; never update/delete
create policy evt_read   on public.events for select to authenticated
  using (org_id = public.current_org_id());
create policy evt_insert on public.events for insert to authenticated
  with check (org_id = public.current_org_id());

-- =====================================================================
-- SECTION 10 — Seed data
--   Indian states/UTs (for state-wise rollup). Cities are added as
--   locations are created. A starter cut list is seeded per-org later.
-- =====================================================================

insert into public.states (name, code) values
  ('Andhra Pradesh','AP'), ('Arunachal Pradesh','AR'), ('Assam','AS'),
  ('Bihar','BR'), ('Chhattisgarh','CG'), ('Goa','GA'), ('Gujarat','GJ'),
  ('Haryana','HR'), ('Himachal Pradesh','HP'), ('Jharkhand','JH'),
  ('Karnataka','KA'), ('Kerala','KL'), ('Madhya Pradesh','MP'),
  ('Maharashtra','MH'), ('Manipur','MN'), ('Meghalaya','ML'), ('Mizoram','MZ'),
  ('Nagaland','NL'), ('Odisha','OD'), ('Punjab','PB'), ('Rajasthan','RJ'),
  ('Sikkim','SK'), ('Tamil Nadu','TN'), ('Telangana','TS'), ('Tripura','TR'),
  ('Uttar Pradesh','UP'), ('Uttarakhand','UK'), ('West Bengal','WB'),
  ('Andaman and Nicobar Islands','AN'), ('Chandigarh','CH'),
  ('Dadra and Nagar Haveli and Daman and Diu','DN'), ('Delhi','DL'),
  ('Jammu and Kashmir','JK'), ('Ladakh','LA'), ('Lakshadweep','LD'),
  ('Puducherry','PY')
on conflict (name) do nothing;

-- =====================================================================
-- SECTION 11 — First-run bootstrap (RUN ONCE, then remove/comment)
--   Creates the org, your first farm + store, seeds a cut list, and
--   links your auth user as the owner. Replace the email + names first.
-- =====================================================================
-- do $$
-- declare
--   v_org   uuid;
--   v_city  uuid;
--   v_farm  uuid;
--   v_store uuid;
--   v_uid   uuid;
-- begin
--   -- 1) your org
--   insert into public.organizations (name) values ('Farmers Fresh')
--     returning id into v_org;
--
--   -- 2) a city under a state (example: Hyderabad, Telangana)
--   insert into public.cities (state_id, name)
--     values ((select id from public.states where name = 'Telangana'), 'Hyderabad')
--     returning id into v_city;
--
--   -- 3) first farm + first store
--   insert into public.locations (org_id, city_id, type, name, code)
--     values (v_org, v_city, 'farm', 'Main Farm', 'FARM-01') returning id into v_farm;
--   insert into public.locations (org_id, city_id, type, name, code)
--     values (v_org, v_city, 'store', 'Main Store', 'STORE-01') returning id into v_store;
--
--   -- 4) starter cut list
--   insert into public.products (org_id, name, unit) values
--     (v_org,'Whole','kg'), (v_org,'Leg','kg'), (v_org,'Shoulder','kg'),
--     (v_org,'Chops','kg'), (v_org,'Mince','kg'), (v_org,'Offal','kg');
--
--   -- 5) link YOUR user as owner (create the user in Supabase Auth first,
--   --    then put the email here)
--   select id into v_uid from auth.users where email = 'you@example.com';
--   insert into public.profiles (id, org_id, full_name, is_owner)
--     values (v_uid, v_org, 'Venky', true);
--   insert into public.memberships (org_id, user_id, location_id, role) values
--     (v_org, v_uid, v_farm,  'owner'),
--     (v_org, v_uid, v_store, 'owner');
-- end $$;

-- =====================================================================
-- End of migration 0001
-- =====================================================================

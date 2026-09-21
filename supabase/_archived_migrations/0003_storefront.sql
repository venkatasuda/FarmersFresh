-- =====================================================================
-- Farmers Fresh — Migration 0003: Public storefront
--
-- Customers browse a catalogue and place an order. They pay on delivery,
-- so there is no gateway, no card data, and no refund flow yet.
--
-- THE HARD PART HERE IS NOT THE CART, IT IS TRUST:
--   * The catalogue is readable by `anon` — the whole internet. Every policy
--     below is written assuming a hostile reader.
--   * Anyone can INSERT an order (that is what a shop is), but nobody
--     anonymous can READ one back. Otherwise a stranger could enumerate your
--     customers' names, phones and addresses. Orders go in; only staff see them.
--   * Prices are re-read from the database at checkout. NEVER trust a price
--     posted by the browser — that is the oldest e-commerce hole there is.
-- =====================================================================

-- =====================================================================
-- SECTION 1 — Which org is the public shop?
--   Multi-tenant means "the storefront" is ambiguous. Flag it explicitly
--   rather than hardcoding a UUID in the app.
-- =====================================================================

alter table public.organizations
  add column if not exists storefront_enabled boolean not null default false;

alter table public.organizations
  add column if not exists slug text;

create unique index if not exists uq_org_slug on public.organizations(slug)
  where slug is not null;

-- Security definer so an anonymous visitor can be checked against this
-- without being granted read access to the organizations table itself.
create or replace function public.is_storefront_org(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organizations o
    where o.id = p_org and o.storefront_enabled
  );
$$;

-- The public site needs the storefront's org id to place an order, but anon
-- has no read access to `organizations`. Hand out exactly that one id and
-- nothing else, rather than opening the table or hardcoding a UUID in the app.
create or replace function public.storefront_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.organizations
  where storefront_enabled
  order by created_at
  limit 1;
$$;

revoke all on function public.storefront_org_id() from public;
grant execute on function public.storefront_org_id() to anon, authenticated;

-- =====================================================================
-- SECTION 2 — Products become sellable online
--   Phase 1 products were an internal cut list. They now need a public
--   face: a URL, a price, a picture, a description.
-- =====================================================================

alter table public.products
  add column if not exists slug           text,
  add column if not exists description    text,
  add column if not exists sale_price     numeric(12,2) check (sale_price >= 0),
  add column if not exists image_path     text,          -- '/products/mutton-curry-cut.jpg'
  add column if not exists category       text,
  add column if not exists is_published   boolean not null default false,
  add column if not exists sort_order     integer not null default 100,
  add column if not exists min_order_qty  numeric(12,3) not null default 0.5,
  add column if not exists step_qty       numeric(12,3) not null default 0.5;

create unique index if not exists uq_products_slug on public.products(org_id, slug)
  where slug is not null;
create index if not exists idx_products_published
  on public.products(org_id, is_published, sort_order);

-- A product cannot go live without the things a customer needs to decide.
alter table public.products drop constraint if exists products_publishable;
alter table public.products add constraint products_publishable check (
  not is_published
  or (slug is not null and sale_price is not null and sale_price > 0)
);

-- =====================================================================
-- SECTION 3 — Orders
--   Deliberately SEPARATE from `sales`. A sale is money taken at a counter,
--   now, by a named staff member. An order is a promise made online that
--   may still be cancelled, and that no employee has touched yet.
--   Collapsing the two would corrupt both the till and the ledger.
--   When an order is delivered and paid, THEN it becomes a sale.
-- =====================================================================

create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  location_id      uuid references public.locations(id) on delete set null, -- fulfilling store
  order_number     text not null,
  customer_id      uuid references public.customers(id) on delete set null, -- linked once known
  contact_name     text not null,
  contact_phone    text not null,
  address_line     text not null,
  city             text,
  pincode          text,
  landmark         text,
  delivery_slot    text,             -- 'today_evening', 'tomorrow_morning'
  notes            text,
  subtotal         numeric(12,2) not null default 0 check (subtotal >= 0),
  delivery_fee     numeric(12,2) not null default 0 check (delivery_fee >= 0),
  total            numeric(12,2) not null default 0 check (total >= 0),
  payment_method   text not null default 'cod' check (payment_method in ('cod','upi_on_delivery')),
  status           text not null default 'placed'
                   check (status in ('placed','confirmed','packed','out_for_delivery','delivered','cancelled')),
  placed_at        timestamptz not null default now(),
  confirmed_at     timestamptz,
  delivered_at     timestamptz,
  cancelled_reason text,
  sale_id          uuid references public.sales(id) on delete set null, -- set when it becomes money
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (org_id, order_number)
);
create index if not exists idx_orders_org_status on public.orders(org_id, status, placed_at desc);
create index if not exists idx_orders_phone      on public.orders(contact_phone);
create trigger trg_orders_updated before update on public.orders
  for each row execute function public.set_updated_at();

create table if not exists public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  product_id   uuid not null references public.products(id) on delete restrict,
  -- Name and price are COPIED, not joined. If you re-price mutton next week,
  -- last week's order must still show what the customer actually agreed to.
  product_name text not null,
  unit         text not null default 'kg',
  quantity     numeric(12,3) not null check (quantity > 0),
  unit_price   numeric(12,2) not null check (unit_price >= 0),
  line_total   numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored,
  created_at   timestamptz not null default now()
);
create index if not exists idx_order_items_order on public.order_items(order_id);

-- =====================================================================
-- SECTION 4 — Order number
--   Human-readable, speakable over a phone: FF-260718-0042
-- =====================================================================

create sequence if not exists public.order_number_seq;

create or replace function public.next_order_number()
returns text language sql volatile as $$
  select 'FF-' || to_char(now(), 'YYMMDD') || '-' ||
         lpad((nextval('public.order_number_seq') % 10000)::text, 4, '0');
$$;

-- =====================================================================
-- SECTION 5 — Placing an order (the only write anon may perform)
--
--   The browser sends product ids and quantities. It does NOT send prices.
--   This function looks the prices up itself, so a customer editing the
--   page cannot buy mutton for ₹1.
-- =====================================================================

create type public.cart_line as (product_id uuid, quantity numeric);

create or replace function public.place_order(
  p_org_id        uuid,
  p_contact_name  text,
  p_contact_phone text,
  p_address_line  text,
  p_city          text,
  p_pincode       text,
  p_landmark      text,
  p_delivery_slot text,
  p_notes         text,
  p_lines         public.cart_line[]
)
returns table (order_id uuid, order_number text, total numeric)
language plpgsql volatile security definer set search_path = public as $$
declare
  v_order_id uuid;
  v_number   text;
  v_subtotal numeric(12,2) := 0;
  v_fee      numeric(12,2) := 0;
  v_line     public.cart_line;
  v_count    int;
begin
  if not public.is_storefront_org(p_org_id) then
    raise exception 'This shop is not open.';
  end if;

  if coalesce(trim(p_contact_name), '') = ''
     or coalesce(trim(p_contact_phone), '') = ''
     or coalesce(trim(p_address_line), '') = '' then
    raise exception 'Name, phone and address are required.';
  end if;

  -- Indian mobile numbers: 10 digits, first digit 6-9. Strip spaces first.
  if regexp_replace(p_contact_phone, '\s|-|\+91', '', 'g') !~ '^[6-9][0-9]{9}$' then
    raise exception 'Enter a valid 10-digit mobile number.';
  end if;

  v_count := coalesce(array_length(p_lines, 1), 0);
  if v_count = 0 then
    raise exception 'Your basket is empty.';
  end if;
  if v_count > 40 then
    raise exception 'Too many items in one order.';
  end if;

  v_number := public.next_order_number();

  insert into public.orders (
    org_id, order_number, contact_name, contact_phone, address_line,
    city, pincode, landmark, delivery_slot, notes
  ) values (
    p_org_id, v_number, trim(p_contact_name), trim(p_contact_phone),
    trim(p_address_line), nullif(trim(coalesce(p_city,'')), ''),
    nullif(trim(coalesce(p_pincode,'')), ''), nullif(trim(coalesce(p_landmark,'')), ''),
    nullif(trim(coalesce(p_delivery_slot,'')), ''), nullif(trim(coalesce(p_notes,'')), '')
  ) returning id into v_order_id;

  -- Prices come from the products table, never from the caller.
  foreach v_line in array p_lines loop
    insert into public.order_items (
      order_id, product_id, product_name, unit, quantity, unit_price
    )
    select v_order_id, p.id, p.name, p.unit, v_line.quantity, p.sale_price
    from public.products p
    where p.id = v_line.product_id
      and p.org_id = p_org_id
      and p.is_published
      and p.is_active
      and p.sale_price is not null
      and v_line.quantity > 0
      and v_line.quantity <= 50;   -- sanity ceiling
  end loop;

  select coalesce(sum(line_total), 0) into v_subtotal
  from public.order_items where order_id = v_order_id;

  if v_subtotal <= 0 then
    -- Every line was rejected: unpublished, unpriced, or fabricated ids.
    delete from public.orders where id = v_order_id;
    raise exception 'None of those items are available right now.';
  end if;

  -- Free delivery over ₹500, otherwise ₹40.
  v_fee := case when v_subtotal >= 500 then 0 else 40 end;

  update public.orders
     set subtotal = v_subtotal,
         delivery_fee = v_fee,
         total = v_subtotal + v_fee
   where id = v_order_id;

  insert into public.events (org_id, event_type, entity_type, entity_id, payload)
  values (p_org_id, 'order.placed', 'order', v_order_id,
          jsonb_build_object('order_number', v_number, 'total', v_subtotal + v_fee));

  return query select v_order_id, v_number, v_subtotal + v_fee;
end $$;

revoke all on function public.place_order(uuid,text,text,text,text,text,text,text,text,public.cart_line[]) from public;
grant execute on function public.place_order(uuid,text,text,text,text,text,text,text,text,public.cart_line[]) to anon, authenticated;

-- =====================================================================
-- SECTION 6 — Row-level security
-- =====================================================================

alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- PUBLIC CATALOGUE: anyone may read published products of a storefront org.
-- Note this exposes name, price, description, image — and nothing else.
create policy prod_public_read on public.products for select to anon
  using (is_published and is_active and public.is_storefront_org(org_id));

-- Staff read orders for their locations; owners see the whole org.
-- There is deliberately NO anon select policy — orders are write-only to
-- the public, so nobody can enumerate customer addresses.
create policy orders_read on public.orders for select to authenticated
  using (
    org_id = public.current_org_id()
    and (public.is_org_owner() or location_id is null or public.has_location(location_id))
  );
create policy orders_update on public.orders for update to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
create policy orders_delete on public.orders for delete to authenticated
  using (org_id = public.current_org_id() and public.is_org_owner());

create policy order_items_read on public.order_items for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and o.org_id = public.current_org_id()
  ));

-- =====================================================================
-- SECTION 7 — Staff view: the order queue
-- =====================================================================

create or replace view public.order_queue
with (security_invoker = true) as
select
  o.id,
  o.org_id,
  o.order_number,
  o.contact_name,
  o.contact_phone,
  o.address_line,
  o.city,
  o.pincode,
  o.delivery_slot,
  o.status,
  o.total,
  o.placed_at,
  count(oi.id)          as item_count,
  sum(oi.quantity)      as total_quantity
from public.orders o
left join public.order_items oi on oi.order_id = o.id
where o.status not in ('delivered', 'cancelled')
group by o.id;

-- =====================================================================
-- SECTION 8 — Turn the shop on and seed the catalogue (RUN ONCE)
--   Replace the org id, then uncomment and run.
-- =====================================================================
-- update public.organizations
--    set storefront_enabled = true, slug = 'farmersfresh'
--  where name = 'Farmers Fresh';
--
-- update public.products set
--   slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')),
--   category = 'Mutton',
--   is_published = true
-- where org_id = (select id from public.organizations where name = 'Farmers Fresh');
--
-- -- Then set a real price and picture per cut, e.g.
-- update public.products
--    set sale_price = 850, image_path = '/products/leg.jpg', description = 'Bone-in leg, cleaned and cut to size.'
--  where slug = 'leg';

-- =====================================================================
-- End of migration 0003
-- =====================================================================

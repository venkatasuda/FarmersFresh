-- =====================================================================
-- Farmers Fresh — Migration 0011: Delivery zones + notification outbox
-- APPLIED to project bjevoybwufubtprkxbvb.
--
-- Two launch blockers, both database-first.
--
-- 1. DELIVERY ZONES. Accepting an address you can't reach is the one mistake
--    that burns a new brand: the customer waits, then gets a cancellation
--    call. A PIN allowlist means checkout refuses out-of-area orders before
--    they are placed. It only bites once the org has added at least one zone,
--    so an un-configured shop still takes orders and launch isn't blocked.
--
-- 2. NOTIFICATIONS AS AN OUTBOX. place_order does NOT call an email/SMS API
--    directly — a slow or failing provider would make a customer's order hang
--    or fail. Instead it writes rows to `notifications` INSIDE the order
--    transaction, and a scheduled Edge Function (`send-notifications`) drains
--    them. This is the transactional-outbox pattern: if the order commits the
--    alert exists; if it rolls back so does the alert; a dead provider can
--    never block a sale.
--
-- The channels: email via Resend, SMS via MSG91, WhatsApp via Meta Cloud API.
-- A channel with no provider key is marked 'skipped', so all three can be
-- enqueued now and light up as keys are added. See the function's env vars.
-- =====================================================================

create table if not exists public.delivery_zones (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  pincode      text not null,
  area_name    text,
  delivery_fee numeric(12,2),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (org_id, pincode)
);
create index if not exists idx_zones_org on public.delivery_zones(org_id, pincode) where is_active;

create or replace function public.delivers_to(p_org uuid, p_pincode text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.delivery_zones
    where org_id = p_org and is_active
      and pincode = regexp_replace(coalesce(p_pincode, ''), '\s', '', 'g')
  );
$$;
revoke all on function public.delivers_to(uuid,text) from public;
grant execute on function public.delivers_to(uuid,text) to anon, authenticated;

create or replace function public.served_areas()
returns table (pincode text, area_name text)
language sql stable security definer set search_path = public as $$
  select z.pincode, z.area_name
  from public.delivery_zones z
  join public.organizations o on o.id = z.org_id
  where z.is_active and o.storefront_enabled
  order by z.area_name nulls last, z.pincode;
$$;
revoke all on function public.served_areas() from public;
grant execute on function public.served_areas() to anon, authenticated;

alter table public.delivery_zones enable row level security;

drop policy if exists zone_public_read on public.delivery_zones;
create policy zone_public_read on public.delivery_zones for select to anon
  using (is_active and public.is_storefront_org(org_id));

drop policy if exists zone_staff_read on public.delivery_zones;
create policy zone_staff_read on public.delivery_zones for select to authenticated
  using (org_id = public.current_org_id());

drop policy if exists zone_owner_write on public.delivery_zones;
create policy zone_owner_write on public.delivery_zones for all to authenticated
  using (org_id = public.current_org_id() and public.is_org_owner())
  with check (org_id = public.current_org_id() and public.is_org_owner());

create table if not exists public.notifications (
  id         bigint generated always as identity primary key,
  org_id     uuid not null references public.organizations(id) on delete cascade,
  channel    text not null check (channel in ('email','sms','whatsapp')),
  recipient  text not null,
  template   text not null,
  payload    jsonb not null default '{}'::jsonb,
  status     text not null default 'pending'
             check (status in ('pending','sent','failed','skipped')),
  attempts   int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);
create index if not exists idx_notifications_pending
  on public.notifications(created_at) where status = 'pending';

alter table public.notifications enable row level security;

-- Staff READ only. Delivery status is written by the worker as service_role,
-- which bypasses RLS — so there is deliberately no client write policy.
drop policy if exists notif_staff_read on public.notifications;
create policy notif_staff_read on public.notifications for select to authenticated
  using (org_id = public.current_org_id());

alter table public.organizations
  add column if not exists notify_email text,
  add column if not exists notify_phone text;

-- place_order was also updated in this migration to (a) enforce the zone and
-- (b) enqueue email + SMS + WhatsApp alerts. See 0011b in the repo, or the
-- live definition — the full body is long and lives with the reservation
-- logic from 0005.

-- Scheduling (also applied): pg_cron + pg_net call the send-notifications
-- Edge Function once a minute.
--   select cron.schedule('drain-notifications', '* * * * *', $$
--     select net.http_post(
--       url := 'https://<ref>.supabase.co/functions/v1/send-notifications',
--       headers := '{"Content-Type":"application/json"}'::jsonb, body := '{}'::jsonb);
--   $$);

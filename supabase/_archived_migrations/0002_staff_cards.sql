-- =====================================================================
-- Farmers Fresh — Migration 0002: Staff cards + stations
--
-- Two tiers of people use this system:
--
--   Office (owner, manager, accountant) — a real Supabase Auth account,
--     email + password, full session, RLS scoped to their locations.
--
--   Floor / production (butchers, packers, counter) — NO account. They tap
--     an RFID card on a shared station device that is already signed in.
--
-- WHY CARDS ARE NOT LOGINS
-- An RFID card UID is a plain number broadcast to any reader that asks. A
-- cloner costs less than a bag of feed. It is an IDENTIFIER, not a SECRET,
-- so it must never by itself open a session that can move money.
--
-- The trust therefore sits in the STATION, not the card:
--   1. The station device signs in once as a station account (a real profile
--      with role 'staff' scoped to that one location).
--   2. A worker taps their card. We resolve the UID to a staff_member.
--   3. Actions are recorded as "done by this worker, at this station".
--
-- So a stolen card gets you nothing unless you are also standing at the
-- store, at the signed-in terminal, in front of everyone.
--
-- Card UIDs are stored HASHED, never in the clear — same reasoning as
-- passwords. A leaked database should not hand over a cloneable card list.
-- =====================================================================

-- ---------- Extensions ----------
create extension if not exists pgcrypto;  -- digest() for hashing

-- =====================================================================
-- SECTION 1 — Staff members (people without accounts)
--   Deliberately separate from `profiles`. A profile is an auth identity;
--   a staff_member is a person on the floor. Some people are both, which
--   is what `profile_id` is for.
-- =====================================================================

create table if not exists public.staff_members (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  location_id   uuid not null references public.locations(id) on delete restrict,
  profile_id    uuid references public.profiles(id) on delete set null, -- set if they also log in
  full_name     text not null,
  phone         text,
  job_title     text,                         -- 'butcher', 'packer', 'cleaner'
  employment    text not null default 'production'
                check (employment in ('production','office','contract')),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_staff_org_loc on public.staff_members(org_id, location_id);
create index if not exists idx_staff_active  on public.staff_members(org_id, is_active);
create trigger trg_staff_updated before update on public.staff_members
  for each row execute function public.set_updated_at();

-- =====================================================================
-- SECTION 2 — Cards
--   One person may hold more than one card over time (lost, replaced).
--   Old cards are revoked, never deleted, so history stays readable.
-- =====================================================================

create table if not exists public.staff_cards (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  staff_member_id  uuid not null references public.staff_members(id) on delete cascade,
  card_uid_hash    bytea not null,            -- sha256(uid || org salt). NEVER the raw UID.
  label            text,                      -- 'blue card', 'replacement 2'
  issued_at        timestamptz not null default now(),
  revoked_at       timestamptz,               -- null = active
  created_at       timestamptz not null default now(),
  unique (org_id, card_uid_hash)
);
create index if not exists idx_cards_staff  on public.staff_cards(staff_member_id);
create index if not exists idx_cards_active on public.staff_cards(org_id, card_uid_hash)
  where revoked_at is null;

-- =====================================================================
-- SECTION 3 — Stations (the trusted device)
--   A station is a physical terminal at one location. It is bound to a
--   profile (the account the device signs in as), so every tap is anchored
--   to a place and a session.
-- =====================================================================

create table if not exists public.stations (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  location_id  uuid not null references public.locations(id) on delete cascade,
  profile_id   uuid references public.profiles(id) on delete set null,
  name         text not null,                 -- 'Counter 1', 'Cutting room'
  is_active    boolean not null default true,
  last_seen_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (org_id, location_id, name)
);
create index if not exists idx_stations_org_loc on public.stations(org_id, location_id);
create trigger trg_stations_updated before update on public.stations
  for each row execute function public.set_updated_at();

-- =====================================================================
-- SECTION 4 — Shifts (clock in / clock out)
--   One open shift per person at a time, enforced by a partial unique index
--   so a double tap can't create two open shifts.
-- =====================================================================

create table if not exists public.shifts (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  location_id      uuid not null references public.locations(id) on delete restrict,
  staff_member_id  uuid not null references public.staff_members(id) on delete restrict,
  station_id       uuid references public.stations(id) on delete set null,
  clock_in_at      timestamptz not null default now(),
  clock_out_at     timestamptz,
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (clock_out_at is null or clock_out_at >= clock_in_at)
);
create index if not exists idx_shifts_org_loc on public.shifts(org_id, location_id);
create index if not exists idx_shifts_staff   on public.shifts(staff_member_id, clock_in_at);
create unique index if not exists uq_shift_one_open
  on public.shifts(staff_member_id) where clock_out_at is null;
create trigger trg_shifts_updated before update on public.shifts
  for each row execute function public.set_updated_at();

-- =====================================================================
-- SECTION 5 — Card resolution (security definer)
--   The station calls this with a raw UID; it hashes server-side and
--   returns who tapped. The station never gets to read the card table,
--   and the raw UID never lands in a row.
--
--   Set the salt once per project:
--     alter database postgres set app.card_salt = '<long random string>';
-- =====================================================================

create or replace function public.hash_card_uid(p_uid text)
returns bytea language sql immutable as $$
  select digest(
    coalesce(current_setting('app.card_salt', true), 'farmersfresh-dev-salt') || p_uid,
    'sha256'
  );
$$;

create or replace function public.resolve_card(p_uid text)
returns table (staff_member_id uuid, full_name text, location_id uuid)
language sql stable security definer set search_path = public as $$
  select s.id, s.full_name, s.location_id
  from public.staff_cards c
  join public.staff_members s on s.id = c.staff_member_id
  where c.card_uid_hash = public.hash_card_uid(p_uid)
    and c.revoked_at is null
    and s.is_active
    and c.org_id = public.current_org_id()   -- caller's org only
    and public.has_location(s.location_id);  -- and only their locations
$$;

revoke all on function public.resolve_card(text) from public;
grant execute on function public.resolve_card(text) to authenticated;

-- =====================================================================
-- SECTION 6 — Row-level security
-- =====================================================================

alter table public.staff_members enable row level security;
alter table public.staff_cards   enable row level security;
alter table public.stations      enable row level security;
alter table public.shifts        enable row level security;

-- Staff members: readable within your locations; owners manage.
create policy staff_read on public.staff_members for select to authenticated
  using (org_id = public.current_org_id() and public.has_location(location_id));
create policy staff_write on public.staff_members for all to authenticated
  using (org_id = public.current_org_id() and public.is_org_owner())
  with check (org_id = public.current_org_id() and public.is_org_owner());

-- Cards: OWNERS ONLY, and never readable by the floor. Even an owner sees
-- only the hash — the raw UID exists nowhere in the database.
create policy cards_all on public.staff_cards for all to authenticated
  using (org_id = public.current_org_id() and public.is_org_owner())
  with check (org_id = public.current_org_id() and public.is_org_owner());

-- Stations: readable within your locations; owners manage.
create policy stations_read on public.stations for select to authenticated
  using (org_id = public.current_org_id() and public.has_location(location_id));
create policy stations_write on public.stations for all to authenticated
  using (org_id = public.current_org_id() and public.is_org_owner())
  with check (org_id = public.current_org_id() and public.is_org_owner());

-- Shifts: any signed-in user at that location can read and open/close them
-- (the station account does this on the worker's behalf). Owners delete.
create policy shifts_read on public.shifts for select to authenticated
  using (org_id = public.current_org_id() and public.has_location(location_id));
create policy shifts_write on public.shifts for insert to authenticated
  with check (org_id = public.current_org_id() and public.has_location(location_id));
create policy shifts_update on public.shifts for update to authenticated
  using (org_id = public.current_org_id() and public.has_location(location_id))
  with check (org_id = public.current_org_id() and public.has_location(location_id));
create policy shifts_delete on public.shifts for delete to authenticated
  using (org_id = public.current_org_id() and public.is_org_owner());

-- =====================================================================
-- SECTION 7 — Reporting view: who is on the floor right now
-- =====================================================================

create or replace view public.open_shifts
with (security_invoker = true) as
select
  sh.id as shift_id,
  sh.org_id,
  sh.location_id,
  sh.staff_member_id,
  s.full_name,
  s.job_title,
  sh.station_id,
  sh.clock_in_at,
  now() - sh.clock_in_at as elapsed
from public.shifts sh
join public.staff_members s on s.id = sh.staff_member_id
where sh.clock_out_at is null;

-- =====================================================================
-- SECTION 8 — Issuing a card (run from the SQL editor, as owner)
--   Never insert a raw UID directly into staff_cards.
-- =====================================================================
-- insert into public.staff_cards (org_id, staff_member_id, card_uid_hash, label)
-- values (
--   '<org-uuid>',
--   '<staff-member-uuid>',
--   public.hash_card_uid('04A2B3C4D5E6'),   -- the UID your reader printed
--   'blue card'
-- );

-- =====================================================================
-- End of migration 0002
-- =====================================================================

-- =====================================================================
-- Migration 0029: Saved address book
--
-- Logged-in customers can save multiple delivery addresses and pick one at
-- checkout. RLS scopes every row to the owning auth user, so the client can
-- do plain CRUD safely — a customer only ever sees and edits their own.
-- =====================================================================

create table if not exists public.customer_addresses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  label         text,                         -- 'Home', 'Office'
  contact_name  text,
  contact_phone text,
  address_line  text not null,
  city          text,
  pincode       text,
  landmark      text,
  is_default    boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists idx_addr_user on public.customer_addresses(user_id);

alter table public.customer_addresses enable row level security;

drop policy if exists addr_read on public.customer_addresses;
create policy addr_read on public.customer_addresses for select to authenticated
  using (user_id = auth.uid());

drop policy if exists addr_write on public.customer_addresses;
create policy addr_write on public.customer_addresses for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Keep at most one default per user: when one is set default, clear the rest.
create or replace function public.one_default_address()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_default then
    update public.customer_addresses
       set is_default = false
     where user_id = new.user_id and id <> new.id and is_default;
  end if;
  return new;
end $$;

drop trigger if exists trg_one_default_address on public.customer_addresses;
create trigger trg_one_default_address
  after insert or update of is_default on public.customer_addresses
  for each row when (new.is_default)
  execute function public.one_default_address();

revoke all on function public.one_default_address() from public, anon, authenticated;

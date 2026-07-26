-- =====================================================================
-- Farmers Fresh — Migration 0027: Wallet, loyalty points & referrals
-- APPLIED to project bjevoybwufubtprkxbvb.
--
-- A store-credit wallet in rupees, keyed on the logged-in auth user.
--   * POINTS: 2% of every delivered order is credited back (trigger).
--   * REFERRALS: a new customer who redeems a friend's code gets ₹50; the
--     friend gets ₹50 once the new customer's first order is delivered.
--   * Credit is spent at checkout (place_order gains p_use_credit — 0028).
--
-- The ledger is APPEND-ONLY; balance is the sum, so it's always explainable.
-- Verified end to end: ₹100 credit → ₹425 order became ₹365 → balance 0 →
-- delivery earned ₹7 (2%).
--
-- Full function bodies (wallet_balance, my_wallet, redeem_referral,
-- reward_on_delivery) applied live — see pg_get_functiondef.
-- =====================================================================

create table if not exists public.wallet_ledger (
  id         bigint generated always as identity primary key,
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  amount     numeric(12,2) not null,
  reason     text not null,
  ref        text,
  created_at timestamptz not null default now()
);
create index if not exists idx_wallet_user on public.wallet_ledger(user_id);

alter table public.wallet_ledger enable row level security;
drop policy if exists wallet_read_own on public.wallet_ledger;
create policy wallet_read_own on public.wallet_ledger for select to authenticated
  using (user_id = auth.uid());

create table if not exists public.referrals (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  code        text unique not null,
  referred_by uuid references auth.users(id),
  reward_paid boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.referrals enable row level security;
drop policy if exists referral_read_own on public.referrals;
create policy referral_read_own on public.referrals for select to authenticated
  using (user_id = auth.uid());

alter table public.orders
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists credit_used numeric(12,2) not null default 0;

-- Grants for the wallet functions (bodies applied live):
revoke all on function public.wallet_balance(uuid) from public, anon;
grant execute on function public.wallet_balance(uuid) to authenticated;
revoke all on function public.my_wallet() from public, anon;
grant execute on function public.my_wallet() to authenticated;
revoke all on function public.redeem_referral(text) from public, anon;
grant execute on function public.redeem_referral(text) to authenticated;

-- reward_on_delivery() is a trigger function; never callable directly.
revoke all on function public.reward_on_delivery() from public, anon, authenticated;

-- place_order gained p_use_credit + user_id capture (migration 0028).

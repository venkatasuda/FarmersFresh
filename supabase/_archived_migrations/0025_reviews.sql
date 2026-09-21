-- =====================================================================
-- Farmers Fresh — Migration 0025: Ratings & reviews
-- APPLIED to project bjevoybwufubtprkxbvb.
--
-- Star ratings + written reviews. Reviews are written through add_review()
-- (never a raw anon insert): it validates, blocks a second review of the same
-- product from the same person, and marks a review "verified" when that phone/
-- email actually bought the product. Only a contact HASH is stored — never the
-- raw phone or email — so the table can't leak customer identity.
--
-- Functions: product_ratings() (aggregate for cards), get_product_reviews()
-- (list), add_review() (write). Verified: 5+4 → 4.5 avg, dupe blocked.
-- =====================================================================

create table if not exists public.reviews (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  product_id   uuid not null references public.products(id) on delete cascade,
  author_name  text not null,
  rating       int not null check (rating between 1 and 5),
  body         text,
  contact_hash text,
  verified     boolean not null default false,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (product_id, contact_hash)
);
create index if not exists idx_reviews_product on public.reviews(product_id) where is_published;

alter table public.reviews enable row level security;

drop policy if exists review_public_read on public.reviews;
create policy review_public_read on public.reviews for select to anon, authenticated
  using (is_published and public.is_storefront_org(org_id));

drop policy if exists review_owner on public.reviews;
create policy review_owner on public.reviews for all to authenticated
  using (org_id = public.current_org_id() and public.is_org_owner())
  with check (org_id = public.current_org_id() and public.is_org_owner());

-- Full function bodies (product_ratings, get_product_reviews, add_review)
-- applied live — see pg_get_functiondef. Grants:
revoke all on function public.product_ratings() from public;
grant execute on function public.product_ratings() to anon, authenticated;
revoke all on function public.get_product_reviews(uuid,int) from public;
grant execute on function public.get_product_reviews(uuid,int) to anon, authenticated;
revoke all on function public.add_review(uuid,text,int,text,text) from public;
grant execute on function public.add_review(uuid,text,int,text,text) to anon, authenticated;

-- VEN-9: anonymous add_review allowed unlimited 1-star spam, 200 KB bodies,
-- and told anyone whether a phone number had bought a product ("verified").
-- Now: signed-in customers only, one review per account per product,
-- "verified" = the reviewer's OWN delivered order, and length caps.
-- p_contact is kept in the signature so old clients don't break; it is ignored.
create or replace function public.add_review(p_product uuid, p_name text, p_rating integer, p_body text, p_contact text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_org uuid; v_uid uuid := auth.uid(); v_verified boolean;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'message', 'Sign in to leave a review.'); end if;
  v_org := public.storefront_org_id();
  if v_org is null then return jsonb_build_object('ok', false, 'message', 'Shop not open.'); end if;
  if not exists (select 1 from public.products where id = p_product and org_id = v_org and is_published) then
    return jsonb_build_object('ok', false, 'message', 'Product not found.');
  end if;
  if coalesce(trim(p_name),'') = '' then return jsonb_build_object('ok', false, 'message', 'Please add your name.'); end if;
  if length(trim(p_name)) > 80 then return jsonb_build_object('ok', false, 'message', 'Name is too long (80 characters max).'); end if;
  if length(coalesce(p_body,'')) > 2000 then return jsonb_build_object('ok', false, 'message', 'Review is too long (2000 characters max).'); end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    return jsonb_build_object('ok', false, 'message', 'Pick a rating from 1 to 5.');
  end if;

  select exists (
    select 1 from public.orders o join public.order_items oi on oi.order_id = o.id
    where o.org_id = v_org and o.user_id = v_uid and oi.product_id = p_product and o.status = 'delivered'
  ) into v_verified;

  begin
    insert into public.reviews (org_id, product_id, author_name, rating, body, contact_hash, verified)
    values (v_org, p_product, trim(p_name), p_rating, nullif(trim(coalesce(p_body,'')), ''), md5(v_uid::text), v_verified);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'message', 'You''ve already reviewed this item.');
  end;
  return jsonb_build_object('ok', true, 'verified', v_verified);
end $$;

revoke execute on function public.add_review(uuid, text, integer, text, text) from public, anon;
grant execute on function public.add_review(uuid, text, integer, text, text) to authenticated;

-- VEN-13: p_limit = -1 raised a raw error and there was no upper bound.
create or replace function public.get_product_reviews(p_product uuid, p_limit integer default 20)
returns table(author_name text, rating integer, body text, verified boolean, created_at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select r.author_name, r.rating, r.body, r.verified, r.created_at
  from public.reviews r
  where r.product_id = p_product and r.is_published
  order by r.verified desc, r.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

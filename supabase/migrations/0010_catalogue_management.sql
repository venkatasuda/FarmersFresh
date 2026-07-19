-- =====================================================================
-- Farmers Fresh — Migration 0010: Catalogue management
--
-- ⚠ NOT YET APPLIED. The migration tool was unavailable when this was
--    written. RUN THIS IN THE SUPABASE SQL EDITOR before using
--    /dashboard/catalogue — the screens call save_product() and
--    retire_product(), and will error until these exist.
--    (Or ask me to apply it once the tool recovers.)
--
-- Until now the only way to add a product or change a price was raw SQL.
-- That is not a system the owner can run. This adds the functions the admin
-- screens need, with the rules enforced in the DATABASE rather than the
-- form — because a form can be bypassed and a constraint cannot.
--
-- Rules that live here, not in React:
--   * Only an org owner may touch the catalogue.
--   * Publishing requires a price and a category. A live listing with no
--     price is a confused phone call waiting to happen.
--   * Slugs are generated and kept unique per org.
--   * `unit` is DERIVED from pack_size, so the storefront's quantity stepper
--     can never disagree with the data. See migration 0008.
-- =====================================================================

create or replace function public.slugify(p_text text)
returns text language sql immutable as $$
  select trim(both '-' from
    regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.save_product(
  p_id               uuid,          -- null to create
  p_name             text,
  p_category_id      uuid,
  p_brand_id         uuid,
  p_sale_price       numeric,
  p_compare_at_price numeric,
  p_description      text,
  p_pack_size        numeric,
  p_pack_unit        text,
  p_badge            text,
  p_image_path       text,
  p_is_published     boolean,
  p_sort_order       integer default 100
)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare
  v_org uuid; v_id uuid; v_slug text; v_base text; v_n int := 1; v_unit text;
begin
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if not public.is_org_owner() then
    raise exception 'Only an owner can change the catalogue.';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'A product needs a name.';
  end if;

  if p_is_published then
    if p_sale_price is null or p_sale_price <= 0 then
      raise exception 'Set a price before publishing %.', p_name;
    end if;
    if p_category_id is null then
      raise exception 'Choose a category before publishing %.', p_name;
    end if;
  end if;

  -- A product is either pack-sold or sold loose by weight, and `unit`
  -- follows from that. Deriving it here means the form cannot create a
  -- product the storefront doesn't know how to count.
  v_unit := case when p_pack_size is null then 'kg' else 'piece' end;

  if p_id is null then
    -- Unique slug per org: 'mutton-leg', then 'mutton-leg-2', and so on.
    v_base := nullif(public.slugify(p_name), '');
    if v_base is null then v_base := 'product'; end if;
    v_slug := v_base;
    while exists (select 1 from public.products
                  where org_id = v_org and slug = v_slug) loop
      v_n := v_n + 1;
      v_slug := v_base || '-' || v_n;
    end loop;

    insert into public.products (
      org_id, category_id, brand_id, name, slug, unit, pack_size, pack_unit,
      sale_price, compare_at_price, description, badge, image_path,
      is_published, is_active, sort_order, min_order_qty, step_qty
    ) values (
      v_org, p_category_id, p_brand_id, trim(p_name), v_slug, v_unit,
      p_pack_size, p_pack_unit, p_sale_price, p_compare_at_price,
      nullif(trim(coalesce(p_description, '')), ''),
      nullif(trim(coalesce(p_badge, '')), ''),
      nullif(trim(coalesce(p_image_path, '')), ''),
      coalesce(p_is_published, false), true, coalesce(p_sort_order, 100),
      case when p_pack_size is null then 0.5 else 1 end,
      case when p_pack_size is null then 0.5 else 1 end
    ) returning id into v_id;
  else
    update public.products p set
      category_id      = p_category_id,
      brand_id         = p_brand_id,
      name             = trim(p_name),
      unit             = v_unit,
      pack_size        = p_pack_size,
      pack_unit        = p_pack_unit,
      sale_price       = p_sale_price,
      compare_at_price = p_compare_at_price,
      description      = nullif(trim(coalesce(p_description, '')), ''),
      badge            = nullif(trim(coalesce(p_badge, '')), ''),
      image_path       = nullif(trim(coalesce(p_image_path, '')), ''),
      is_published     = coalesce(p_is_published, false),
      sort_order       = coalesce(p_sort_order, 100),
      min_order_qty    = case when p_pack_size is null then 0.5 else 1 end,
      step_qty         = case when p_pack_size is null then 0.5 else 1 end
    where p.id = p_id and p.org_id = v_org
    returning p.id into v_id;

    if v_id is null then raise exception 'Product not found.'; end if;
  end if;

  -- Keep the denormalised category/brand text in step with the joins.
  update public.products p
     set category = c.name, category_slug = c.slug
    from public.categories c
   where c.id = p.category_id and p.id = v_id;

  update public.products p
     set brand = b.name
    from public.brands b
   where b.id = p.brand_id and p.id = v_id;

  insert into public.events (org_id, actor_id, event_type, entity_type, entity_id, payload)
  values (v_org, auth.uid(),
          case when p_id is null then 'product.created' else 'product.updated' end,
          'product', v_id,
          jsonb_build_object('name', trim(p_name), 'price', p_sale_price,
                             'published', coalesce(p_is_published, false)));

  return v_id;
end $$;

revoke all on function public.save_product(uuid,text,uuid,uuid,numeric,numeric,text,numeric,text,text,text,boolean,integer) from public, anon;
grant execute on function public.save_product(uuid,text,uuid,uuid,numeric,numeric,text,numeric,text,text,text,boolean,integer) to authenticated;

-- Retiring a product. NEVER a delete: the stock ledger references it and is
-- append-only, so a delete would orphan its own history. See 0009.
create or replace function public.retire_product(p_id uuid, p_reason text default null)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_org uuid; v_loc uuid; v_on_hand numeric;
begin
  v_org := public.current_org_id();
  if v_org is null then raise exception 'Not signed in.'; end if;
  if not public.is_org_owner() then
    raise exception 'Only an owner can retire a product.';
  end if;

  select storefront_location_id into v_loc
  from public.organizations where id = v_org;

  if v_loc is not null then
    v_on_hand := public.stock_available(v_loc, p_id);
    if v_on_hand <> 0 then
      insert into public.stock_movements
        (org_id, location_id, product_id, delta, reason, actor_id, note)
      values (v_org, v_loc, p_id, -v_on_hand, 'adjustment', auth.uid(),
              coalesce(p_reason, 'Line discontinued'));
    end if;
  end if;

  update public.products
     set is_published = false, is_active = false
   where id = p_id and org_id = v_org;

  insert into public.events (org_id, actor_id, event_type, entity_type, entity_id, payload)
  values (v_org, auth.uid(), 'product.retired', 'product', p_id,
          jsonb_build_object('reason', p_reason));
end $$;

revoke all on function public.retire_product(uuid,text) from public, anon;
grant execute on function public.retire_product(uuid,text) to authenticated;

-- =====================================================================
-- Storage bucket for product photos (already applied).
-- Public read — they appear on the shop. Owner-only write. 5 MB ceiling:
-- a phone photo is ~3 MB and next/image resizes anyway, so anything larger
-- is wasted bandwidth on a farm connection.
-- =====================================================================
-- insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- values ('product-images', 'product-images', true, 5242880,
--         array['image/jpeg','image/png','image/webp','image/avif']);
--
-- create policy "product images are public" on storage.objects
--   for select to public using (bucket_id = 'product-images');
-- create policy "owners upload product images" on storage.objects
--   for insert to authenticated
--   with check (bucket_id = 'product-images' and public.is_org_owner());

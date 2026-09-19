-- =====================================================================
-- Migration 0085: RBAC sweep. The admin/ops RPCs only checked that the caller
-- had SOME membership (current_org_id() not null); any staff role could call
-- any admin RPC — e.g. a rider could change store settings or issue gift cards.
-- This prepends a role->capability guard (require_permission, from 0082) to each
-- admin RPC, keyed by the capability matrix in 0081.
--
-- Done as a verified transform rather than 39 hand-copied bodies: the guard is
-- inserted after each function's top-level `begin` (plpgsql) or body opener
-- (the one SQL function, get_admin_recipes). If any expected anchor is missing,
-- the whole migration aborts, so partial gating can never ship. Replay-safe:
-- the guard is skipped for any function that already contains require_permission.
--
-- settings.manage is intentionally unseeded in role_capabilities, so only the
-- owner (is_org_owner superuser) passes it — store settings become owner-only.
--
-- Applied live to bjevoybwufubtprkxbvb. Verified with a rolled-back test that
-- demoted the owner to 'staff': financials.read/inventory.adjust/settings.manage
-- => false, orders.manage => true; business_overview and get_store_admin_settings
-- both raised 42501; owner state restored on rollback.
-- =====================================================================
do $mig$
declare
  m record; v_def text; v_new text; v_lang text; v_missing text := '';
begin
  for m in
    select * from (values
      ('update_store_settings','settings.manage'),
      ('get_store_admin_settings','settings.manage'),
      ('issue_gift_card','coupons.manage'),
      ('grant_personal_coupon','coupons.manage'),
      ('instant_refund','orders.manage'),
      ('approve_return','orders.manage'),
      ('reject_return','orders.manage'),
      ('record_account_payment','orders.manage'),
      ('record_sale','orders.manage'),
      ('add_to_order','orders.manage'),
      ('cancel_order','orders.manage'),
      ('upsert_customer','orders.manage'),
      ('resolve_support_ticket','orders.manage'),
      ('business_overview','financials.read'),
      ('sales_summary','financials.read'),
      ('save_product','catalogue.write'),
      ('retire_product','catalogue.write'),
      ('apply_markdown','catalogue.write'),
      ('revert_markdown','catalogue.write'),
      ('create_recipe','catalogue.write'),
      ('add_recipe_item','catalogue.write'),
      ('set_recipe_image','catalogue.write'),
      ('set_recipe_video','catalogue.write'),
      ('get_admin_recipes','catalogue.write'),
      ('record_stock','inventory.adjust'),
      ('record_production','inventory.adjust'),
      ('log_wastage','inventory.adjust'),
      ('write_off_batch','inventory.adjust'),
      ('add_batch','inventory.adjust'),
      ('log_temperature','inventory.adjust'),
      ('add_farm','inventory.adjust'),
      ('create_purchase_order','procurement.manage'),
      ('add_po_item','procurement.manage'),
      ('remove_po_item','procurement.manage'),
      ('mark_po_ordered','procurement.manage'),
      ('cancel_purchase_order','procurement.manage'),
      ('receive_purchase_order','procurement.manage'),
      ('upsert_supplier','procurement.manage'),
      ('set_supplier_active','procurement.manage')
    ) as t(fn, cap)
  loop
    select pg_get_functiondef(p.oid), l.lanname into v_def, v_lang
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_language l on l.oid = p.prolang
     where n.nspname = 'public' and p.proname = m.fn
     limit 1;

    if v_def is null then raise exception 'RBAC sweep: function % not found', m.fn; end if;
    if position('require_permission' in v_def) > 0 then continue; end if;  -- already gated

    if v_lang = 'plpgsql' then
      v_new := regexp_replace(v_def, E'\nbegin\n',
        E'\nbegin\n  perform public.require_permission(' || quote_literal(m.cap) || E');\n');
    else
      v_new := regexp_replace(v_def, E'AS \\$function\\$\n',
        E'AS $function$\n  select public.require_permission(' || quote_literal(m.cap) || E');\n');
    end if;

    if v_new = v_def then
      v_missing := v_missing || m.fn || ' ';
      continue;
    end if;
    execute v_new;
  end loop;

  if v_missing <> '' then
    raise exception 'RBAC sweep: anchor not found, aborting for: %', v_missing;
  end if;
end $mig$;

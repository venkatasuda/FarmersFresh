-- =====================================================================
-- Migration 0087: P1 — stop POS from overselling shared inventory.
-- record_sale inserted negative stock movements with NO availability check and
-- NO row lock, so a counter sale could drive stock negative and race an online
-- checkout for the same units. add_to_order checked availability but didn't lock
-- first, so its check-then-insert had the same lost-update race.
-- Both now take the same up-front FOR UPDATE lock on the location's ledger rows
-- that place_order uses (identical lock order avoids deadlock), and record_sale
-- gains the per-line availability check. Applied live to bjevoybwufubtprkxbvb.
--
-- Surgical, idempotent transforms over the current bodies (see 0085/0086 for the
-- pattern); each aborts if its anchor is missing and no-ops if already applied.
-- =====================================================================
do $mig$
declare v_def text; v_new text;
begin
  -- record_sale: lock + per-line availability check
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='record_sale';
  if v_def is null then raise exception 'record_sale not found'; end if;

  if position('is out of stock' in v_def) = 0 then
    v_new := replace(v_def,
      E'\n  foreach v_line in array p_lines loop\n',
      E'\n  perform 1 from public.stock_movements\n   where location_id = p_location\n     and product_id in (select (l).product_id from unnest(p_lines) l)\n   for update;\n\n  foreach v_line in array p_lines loop\n');
    if v_new = v_def then raise exception 'record_sale lock anchor not found'; end if;
    v_def := v_new;
    v_new := replace(v_def,
      E'    if v_line.unit_price < 0 then raise exception ''Price cannot be negative.''; end if;\n',
      E'    if v_line.unit_price < 0 then raise exception ''Price cannot be negative.''; end if;\n    if public.stock_available(p_location, v_line.product_id) < v_line.quantity then\n      raise exception ''% is out of stock.'', v_name;\n    end if;\n');
    if v_new = v_def then raise exception 'record_sale availability anchor not found'; end if;
    execute v_new;
  end if;

  -- add_to_order: lock before the check-then-insert loop
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='add_to_order';
  if v_def is null then raise exception 'add_to_order not found'; end if;

  if position('for update' in v_def) = 0 then
    v_new := replace(v_def,
      E'\n  foreach v_line in array p_lines loop\n',
      E'\n  perform 1 from public.stock_movements\n   where location_id = v_loc\n     and product_id in (select (l).product_id from unnest(p_lines) l)\n   for update;\n\n  foreach v_line in array p_lines loop\n');
    if v_new = v_def then raise exception 'add_to_order lock anchor not found'; end if;
    execute v_new;
  end if;
end $mig$;

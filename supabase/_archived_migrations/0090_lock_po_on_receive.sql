-- =====================================================================
-- Migration 0090: P1 — lock the purchase order when receiving it.
-- receive_purchase_order already runs in one transaction, but it checked the
-- PO status (must be draft/ordered) and then wrote without locking the row, so
-- two concurrent receive calls on the same PO could both pass the check and
-- double-receive it — duplicate batches and duplicate stock movements. The PO
-- row is now taken FOR UPDATE, so the second caller waits and then sees status
-- 'received' and raises 'already been received'. Surgical transform over the
-- current body; aborts if the anchor is missing. Applied live to
-- bjevoybwufubtprkxbvb and verified the deployed body carries the lock.
-- =====================================================================
do $mig$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='receive_purchase_order';
  if v_def is null then raise exception 'receive_purchase_order not found'; end if;
  if position('org_id = v_org for update' in v_def) > 0 then return; end if;  -- already locked

  v_new := replace(v_def,
    E'from public.purchase_orders where id = p_po and org_id = v_org;',
    E'from public.purchase_orders where id = p_po and org_id = v_org for update;');
  if v_new = v_def then raise exception 'receive_purchase_order PO-select anchor not found'; end if;
  execute v_new;
end $mig$;

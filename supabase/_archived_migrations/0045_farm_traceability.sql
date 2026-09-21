-- =====================================================================
-- Migration 0045: Internal food-safety traceability
--
-- Staff-only lot tracking: farms register, stock batches tagged with a farm +
-- batch code + harvest/cut date, and a recall trace (orders in a window that
-- contained a product). Customers never see farm names — only a general
-- "traceable" trust mark on the product page.
--
-- Applied live to project bjevoybwufubtprkxbvb. Objects:
--   * farms, product_batches (+ RLS: staff read via current_org_id()).
--   * add_farm / add_batch — staff writes.
--   * get_farms / get_batches — staff reads.
--   * recall_trace(product, from, to) — affected orders for a recall.
-- =====================================================================

revoke all on function public.add_farm(text,text,text,text,text) from public, anon;
grant execute on function public.add_farm(text,text,text,text,text) to authenticated;
revoke all on function public.add_batch(uuid,uuid,text,date,numeric,text) from public, anon;
grant execute on function public.add_batch(uuid,uuid,text,date,numeric,text) to authenticated;
revoke all on function public.get_farms() from public, anon;
grant execute on function public.get_farms() to authenticated;
revoke all on function public.get_batches(int) from public, anon;
grant execute on function public.get_batches(int) to authenticated;
revoke all on function public.recall_trace(uuid,date,date) from public, anon;
grant execute on function public.recall_trace(uuid,date,date) to authenticated;

-- =====================================================================
-- Migration 0040: Returns & refunds
--
-- A customer raises an issue on a delivered order; staff approve (refunding to
-- loyalty points when the order has an account) or reject. Refunds land as
-- points via wallet_ledger (reason 'refund').
--
-- Applied live to project bjevoybwufubtprkxbvb. Objects:
--   * returns table (+ RLS: customer reads own, staff read their org).
--   * request_return(number, reason, phone?)  — customer, anon+authenticated.
--   * get_returns(all?)                        — staff queue.
--   * approve_return(id, refund_points, note?) / reject_return(id, note?) — staff.
-- =====================================================================

revoke all on function public.request_return(text,text,text) from public;
grant execute on function public.request_return(text,text,text) to anon, authenticated;
revoke all on function public.get_returns(boolean) from public, anon;
grant execute on function public.get_returns(boolean) to authenticated;
revoke all on function public.approve_return(uuid,numeric,text) from public, anon;
grant execute on function public.approve_return(uuid,numeric,text) to authenticated;
revoke all on function public.reject_return(uuid,text) from public, anon;
grant execute on function public.reject_return(uuid,text) to authenticated;

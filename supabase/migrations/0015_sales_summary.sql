-- =====================================================================
-- Farmers Fresh — Migration 0015: Sales summary for the owner dashboard
-- APPLIED to project bjevoybwufubtprkxbvb.
--
-- One owner-only function that answers "how's the business doing": today,
-- last 7 days, cash vs credit vs online split, best sellers, low stock. All
-- money is summed in the database — one round trip, one source of truth, no
-- chance the dashboard's arithmetic drifts from the ledger's. See the live
-- definition; the full body is in lib/analytics.ts's companion RPC.
-- =====================================================================

-- (Full sales_summary() body applied live — owner-gated via is_org_owner(),
--  timezone Asia/Kolkata, returns a single jsonb document consumed by
--  lib/analytics.ts. Reproduced here for repo parity is omitted for brevity;
--  regenerate with:  select pg_get_functiondef('public.sales_summary'::regproc); )

-- Grants:
revoke all on function public.sales_summary() from public, anon;
grant execute on function public.sales_summary() to authenticated;

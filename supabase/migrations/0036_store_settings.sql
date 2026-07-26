-- =====================================================================
-- Migration 0036: Store settings & launch config
--
-- Moves hardcoded values (free-delivery threshold, delivery fee) and launch
-- details (support contacts, GSTIN, business address) onto the organizations
-- row, so the owner configures the shop from a settings screen.
--
-- Applied live to project bjevoybwufubtprkxbvb. Objects:
--   * organizations gains support_email/phone, free_delivery_threshold,
--     delivery_fee, gstin, business_address.
--   * get_store_settings()        — customer-safe settings (anon).
--   * get_store_admin_settings()  — full settings incl. staff-alert contacts.
--   * update_store_settings(...)  — staff-only editor (current_org_id scoped).
--   * place_order() recreated to read the fee rule from the org (was 500/40).
-- =====================================================================

alter table public.organizations
  add column if not exists support_email text,
  add column if not exists support_phone text,
  add column if not exists free_delivery_threshold numeric(12,2) not null default 500,
  add column if not exists delivery_fee numeric(12,2) not null default 40,
  add column if not exists gstin text,
  add column if not exists business_address text;

revoke all on function public.get_store_settings() from public;
grant execute on function public.get_store_settings() to anon, authenticated;

revoke all on function public.get_store_admin_settings() from public, anon;
grant execute on function public.get_store_admin_settings() to authenticated;

revoke all on function public.update_store_settings(text,text,text,text,text,numeric,numeric,text,text) from public, anon;
grant execute on function public.update_store_settings(text,text,text,text,text,numeric,numeric,text,text) to authenticated;

-- place_order body recreated live to read free_delivery_threshold / delivery_fee
-- from the organization; grants below.
revoke all on function public.place_order(uuid,text,text,text,text,text,text,text,text,cart_line[],text,text,boolean,text) from public;
grant execute on function public.place_order(uuid,text,text,text,text,text,text,text,text,cart_line[],text,text,boolean,text) to anon, authenticated;

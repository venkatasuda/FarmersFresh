-- =====================================================================
-- Migration 0089: P1 — org-scope the wallet balance.
-- wallet_balance(user) summed wallet_ledger by user_id across ALL orgs, so a
-- user with ledger rows in more than one org could spend org A's credit in
-- org B. Every credit/debit today is written with the storefront org_id and
-- every caller runs in that org's context, so scoping the sum to
-- storefront_org_id() is behaviour-preserving now (verified: storefront credit
-- still counts) and closes the cross-org leak for any future multi-tenant use.
-- Applied live to bjevoybwufubtprkxbvb.
-- =====================================================================
create or replace function public.wallet_balance(p_user uuid)
returns numeric language sql stable security definer set search_path to 'public'
as $function$
  select coalesce(sum(amount), 0)::numeric(12,2)
  from public.wallet_ledger
  where user_id = p_user and org_id = public.storefront_org_id();
$function$;

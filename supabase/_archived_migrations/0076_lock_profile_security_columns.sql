-- =====================================================================
-- Migration 0076: P0 fix — profile privilege escalation
--
-- authenticated/anon held column UPDATE on is_owner/org_id; RLS scopes the ROW
-- (id = auth.uid()) but not the COLUMNS, so a user could self-promote to owner.
-- Fix with column-level privileges. Role/tenant changes now go only through the
-- owner-gated set_member_owner() RPC (SECURITY DEFINER bypasses these grants).
-- Applied live to project bjevoybwufubtprkxbvb.
-- =====================================================================
revoke update on public.profiles from anon;
revoke update on public.profiles from authenticated;
grant update (full_name, updated_at) on public.profiles to authenticated;

create or replace function public.set_member_owner(p_user uuid, p_is_owner boolean)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_org uuid;
begin
  v_org := public.current_org_id();
  if v_org is null or not public.is_org_owner() then
    raise exception 'Only an owner can change roles.';
  end if;
  if p_user = auth.uid() then raise exception 'You cannot change your own owner status.'; end if;
  update public.profiles set is_owner = p_is_owner, updated_at = now()
   where id = p_user and org_id = v_org;
end $$;
revoke all on function public.set_member_owner(uuid,boolean) from public, anon;
grant execute on function public.set_member_owner(uuid,boolean) to authenticated;

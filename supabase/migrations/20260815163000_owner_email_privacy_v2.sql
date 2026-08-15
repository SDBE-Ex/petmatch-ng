-- =========================================================
-- PetMatch NG — owner_email privacy, redone correctly
-- Run once in: Supabase Dashboard > SQL Editor > New query
-- Re-applies the column-level restriction reverted by
-- 20260815162000_restore_pets_select_grant.sql, this time paired with
-- a matching frontend deploy: every select('*') against pets is now an
-- explicit column list (select('*') cannot work with a partial column
-- grant — Postgres requires privilege on the full column set to expand
-- *), and a get_my_pets() RPC covers the one legitimate case of a
-- signed-in user reading their own owner_email to edit a listing.
-- =========================================================

revoke select on public.pets from anon, authenticated;
grant select (
  id, owner_id, owner_name, whatsapp, pet_name, species, breed, gender, age,
  state, notes, breeder, photo_url, created_at, available_for_mating, lat, lng,
  accepts_whatsapp, accepts_calls, accepts_text, is_partner, partner_business_name
) on public.pets to anon, authenticated;

create or replace function public.get_my_pets()
returns setof public.pets
language sql
security definer
set search_path = public
as $$
  select p.* from public.pets p where p.owner_id = auth.uid();
$$;

grant execute on function public.get_my_pets() to authenticated;

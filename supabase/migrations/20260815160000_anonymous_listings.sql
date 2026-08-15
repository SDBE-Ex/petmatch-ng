-- =========================================================
-- PetMatch NG — Anonymous (zero-friction) listings
-- Run once in: Supabase Dashboard > SQL Editor > New query
-- Lets a visitor publish a pet listing without signing in first.
-- Anonymous creation does NOT go through RLS (see note below) — it
-- goes through the new api/pets/create.js endpoint, which verifies a
-- Cloudflare Turnstile token server-side, then inserts using the
-- service-role key. There is deliberately no anonymous INSERT policy
-- on public.pets: the Supabase anon key is public (already embedded
-- in index.html), so a plain "with check (auth.uid() is null ...)"
-- policy would let a bot skip Turnstile entirely by calling the
-- Supabase REST API directly.
-- =========================================================

-- ---------- Schema: allow an unclaimed listing ----------
alter table public.pets alter column owner_id drop not null;
alter table public.pets add column owner_email text;

-- Backfill: owner_id was NOT NULL with an on-delete-cascade FK to
-- auth.users(id), so every existing row is guaranteed to still have a
-- live auth.users match — no orphan case is possible here.
update public.pets p
set owner_email = u.email
from auth.users u
where p.owner_id = u.id;

alter table public.pets alter column owner_email set not null;

-- Supports the claim-on-sign-in lookup and the expiry sweep.
create index pets_unclaimed_owner_email_idx
  on public.pets (lower(owner_email)) where owner_id is null;
create index pets_unclaimed_created_at_idx
  on public.pets (created_at) where owner_id is null;

-- ---------- Claim: a later sign-in attaches matching unclaimed rows ----------
-- SECURITY DEFINER RPC, not a plain RLS policy: a plain UPDATE policy's
-- USING clause would need to read owner_email, which requires the
-- *authenticated* role to hold SELECT on that column — but that column
-- is deliberately not grantable to authenticated (see privacy section
-- below; account creation itself is zero-friction, so "authenticated"
-- is not a meaningful trust boundary for reading everyone's email).
-- A SECURITY DEFINER function reads owner_email as the function owner,
-- bypassing the column grant, while still only ever matching rows
-- against the caller's own verified session email/uid.
create or replace function public.claim_unclaimed_pets()
returns void
language sql
security definer
set search_path = public
as $$
  update public.pets
  set owner_id = auth.uid()
  where owner_id is null
    and lower(owner_email) = lower(auth.jwt() ->> 'email');
$$;

grant execute on function public.claim_unclaimed_pets() to authenticated;

-- ---------- Storage: allow anonymous photo upload ----------
drop policy "Signed-in users can upload pet photos" on storage.objects;

create policy "Anyone can upload pet photos"
on storage.objects for insert
with check (bucket_id = 'pet-photos');

-- ---------- Privacy: owner_email must not be publicly readable ----------
-- pets SELECT RLS is "using (true)" — fully public by design — so a
-- plain new column would leak to any REST caller (incl. the
-- unauthenticated api/pets/[id].js detail page) via default grants.
-- Column-level grants keep every existing "select('*')" caller working
-- unchanged, just silently omitting owner_email.
revoke select on public.pets from anon, authenticated;
grant select (
  id, owner_id, owner_name, whatsapp, pet_name, species, breed, gender, age,
  state, notes, breeder, photo_url, created_at, available_for_mating, lat, lng,
  accepts_whatsapp, accepts_calls, accepts_text, is_partner, partner_business_name
) on public.pets to anon, authenticated;

-- Admins need owner_email visibility — a SECURITY DEFINER function
-- bypasses the column grant above, same mechanism as admin_list_users().
create or replace function public.admin_list_pets()
returns setof public.pets
language sql
security definer
set search_path = public
as $$
  select p.*
  from public.pets p
  where exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email')
  order by p.created_at desc;
$$;

grant execute on function public.admin_list_pets() to authenticated;

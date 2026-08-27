-- =========================================================
-- PetMatch NG — Lead conversion tracking
-- Run once in: Supabase Dashboard > SQL Editor > New query
-- leads.status previously dead-ended at "contacted" with no way to
-- know whether any of it actually worked. Adds a converted_pet_id
-- link and a security-definer RPC that auto-matches a newly listed
-- pet's phone number against open waitlist leads (spotted_form leads
-- don't collect a phone directly, so they stay manual-link-only via
-- the admin Leads tab).
-- =========================================================

alter table public.leads drop constraint leads_status_check;
alter table public.leads add constraint leads_status_check
  check (status in ('new','reviewed','contacted','converted','dismissed'));

alter table public.leads add column if not exists converted_pet_id uuid references public.pets(id) on delete set null;

-- Same digits-only normalization as the client's waLink() helper, so
-- "+234 801 234 5678" and "08012345678" etc. still match.
create or replace function public.digits_only(text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce($1, ''), '[^0-9]', '', 'g');
$$;

-- Called (fire-and-forget, non-blocking) right after a new pet listing
-- is created. Only touches waitlist leads that aren't already
-- converted/dismissed, and only when the phone actually matches —
-- never guesses. security definer because both authenticated and
-- anonymous listing creation need to call this, and leads has no
-- public update policy.
create or replace function public.link_lead_by_phone(pet_id uuid, pet_phone text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.leads
  set converted_pet_id = pet_id, status = 'converted'
  where capture_source = 'waitlist'
    and status not in ('converted','dismissed')
    and digits_only(phone) <> ''
    and digits_only(phone) = digits_only(pet_phone);
end;
$$;

grant execute on function public.link_lead_by_phone(uuid, text) to anon, authenticated;

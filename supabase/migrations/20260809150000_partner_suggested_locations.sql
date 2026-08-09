-- =========================================================
-- PetMatch NG — Suggested Meeting Locations migration
-- Run once in: Supabase Dashboard > SQL Editor > New query
-- Adds lat/lng to partner_applications and a public-safe RPC so the
-- anon/authenticated client can find nearby APPROVED partners to
-- suggest as meeting spots, without exposing partner phone/email/
-- contact_name/business_location over the REST API. Deliberately no
-- public SELECT policy is added to partner_applications itself —
-- Postgres RLS only restricts rows, not columns, so a public policy
-- on the table would let anyone with the anon key read phone/email
-- directly. This function is the only public read path, following
-- the admin_list_users() precedent in 20260731090000_admin_panel.sql.
-- =========================================================

alter table public.partner_applications
  add column if not exists lat double precision,
  add column if not exists lng double precision;

create or replace function public.nearby_approved_partners()
returns table(id uuid, business_name text, business_type text, lat double precision, lng double precision)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.business_name, p.business_type, p.lat, p.lng
  from public.partner_applications p
  where p.status = 'approved'
    and p.lat is not null
    and p.lng is not null;
$$;

grant execute on function public.nearby_approved_partners() to anon, authenticated;

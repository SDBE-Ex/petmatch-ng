-- =========================================================
-- PetMatch NG — MVP feature migration #4
-- Run once in: Supabase Dashboard > SQL Editor > New query
-- Adds: pet business partner applications + partner attribution on pets
-- =========================================================

alter table public.pets
  add column if not exists is_partner boolean not null default false,
  add column if not exists partner_business_name text;

create table public.partner_applications (
  id             uuid primary key default uuid_generate_v4(),
  business_name  text not null,
  business_type  text not null check (business_type in ('Pet Store','Kennel','Breeder','Vet','Other')),
  contact_name   text not null,
  email          text not null,
  phone          text not null,
  city           text not null,
  business_location text,
  website        text,
  status         text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at     timestamptz default now()
);

alter table public.partner_applications enable row level security;

-- Anyone signed in can submit an application
create policy "Signed-in users can submit a partner application"
on public.partner_applications for insert
with check (auth.role() = 'authenticated');

-- A user can only see the status of their own application(s) — matched by
-- their authenticated email, not by an editable client-supplied value
create policy "Users can view their own application status"
on public.partner_applications for select
using (email = auth.jwt() ->> 'email');

-- =========================================================
-- Approving a partner: no admin UI — review new rows in the Supabase
-- Table Editor (partner_applications) and change status to 'approved'.
-- The app checks this table by the signed-in user's email whenever
-- they open "For Pet Businesses" or submit a pet listing as a business.
-- =========================================================

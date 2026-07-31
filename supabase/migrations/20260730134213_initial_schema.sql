-- =========================================================
-- PetMatch NG — Supabase schema
-- Run this whole file once in: Supabase Dashboard > SQL Editor > New query
-- =========================================================

create extension if not exists "uuid-ossp";

-- ---------- Table ----------
create table public.pets (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid references auth.users(id) on delete cascade not null,
  owner_name  text not null,
  whatsapp    text not null,
  pet_name    text not null,
  species     text not null check (species in ('Dog','Cat')),
  breed       text not null,
  gender      text not null check (gender in ('Male','Female')),
  age         numeric not null check (age >= 0),
  state       text not null,
  notes       text,
  breeder     boolean default false,
  photo_url   text,
  created_at  timestamptz default now()
);

-- ---------- Row Level Security ----------
alter table public.pets enable row level security;

-- Anyone (even logged-out visitors) can browse listings
create policy "Public can read listings"
on public.pets for select
using (true);

-- Only a signed-in user can create a listing, and only under their own id
create policy "Signed-in users can create their own listing"
on public.pets for insert
with check (auth.uid() = owner_id);

-- Owners can edit their own listing
create policy "Owners can update their own listing"
on public.pets for update
using (auth.uid() = owner_id);

-- Owners can delete their own listing
create policy "Owners can delete their own listing"
on public.pets for delete
using (auth.uid() = owner_id);

-- ---------- Photo storage ----------
insert into storage.buckets (id, name, public)
values ('pet-photos', 'pet-photos', true)
on conflict (id) do nothing;

create policy "Public can view pet photos"
on storage.objects for select
using (bucket_id = 'pet-photos');

create policy "Signed-in users can upload pet photos"
on storage.objects for insert
with check (bucket_id = 'pet-photos' and auth.role() = 'authenticated');

create policy "Owners can delete their own photos"
on storage.objects for delete
using (bucket_id = 'pet-photos' and auth.uid()::text = (storage.foldername(name))[1]);

-- ---------- Realtime ----------
alter publication supabase_realtime add table public.pets;

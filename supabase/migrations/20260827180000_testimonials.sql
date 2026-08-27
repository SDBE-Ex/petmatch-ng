-- =========================================================
-- PetMatch NG — Testimonials (real proof content, collected not written)
-- Run once in: Supabase Dashboard > SQL Editor > New query
-- A prior SEO/GEO audit flagged proof/stats content as deliberately
-- skipped because there was no real data to back it. This is the
-- collection mechanism: a visitor submits their own story, an admin
-- approves it, and only approved rows are ever publicly readable —
-- nothing here is ever written by anyone but the person it's about.
-- =========================================================

create table public.testimonials (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  quote       text not null check (char_length(quote) between 1 and 600),
  rating      integer check (rating between 1 and 5),
  pet_name    text,
  city        text,
  approved    boolean not null default false,
  created_at  timestamptz default now()
);

alter table public.testimonials enable row level security;

-- Anyone, signed in or not, can submit a testimonial.
create policy "Anyone can submit a testimonial"
on public.testimonials for insert
with check (true);

-- Only approved testimonials are publicly readable — the homepage
-- proof section queries this directly with the anon key.
create policy "Public can read approved testimonials"
on public.testimonials for select
using (approved = true);

-- Admins can read everything, including unapproved submissions.
create policy "Admins can read all testimonials"
on public.testimonials for select
using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

create policy "Admins can update testimonials"
on public.testimonials for update
using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

create policy "Admins can delete testimonials"
on public.testimonials for delete
using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

-- ---------- Realtime, same pattern as posts/leads ----------
alter publication supabase_realtime add table public.testimonials;

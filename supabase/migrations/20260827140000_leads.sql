-- =========================================================
-- PetMatch NG — Leads (Spotted Elsewhere + Waitlist capture)
-- Run once in: Supabase Dashboard > SQL Editor > New query
-- Two low-friction intake points, no login required, feeding one
-- table an admin reviews manually: (1) a visitor tips us off about a
-- mating/stud ad they saw elsewhere, (2) a visitor who isn't ready to
-- list yet leaves their name/phone for later follow-up. Deliberately
-- NOT the automated search-API lead-harvesting design that was also
-- proposed alongside these — that pipeline systematically compiles
-- third-party ad data for cold outreach and was declined; this table
-- only ever holds what a visitor voluntarily submitted about
-- themselves or chose to tip us off about.
-- =========================================================

create table public.leads (
  id               uuid primary key default gen_random_uuid(),
  capture_source   text not null check (capture_source in ('spotted_form','waitlist')),
  name             text,
  phone            text,
  url              text,
  screenshot_url   text,
  pet_type         text,
  city             text,
  status           text not null default 'new' check (status in ('new','reviewed','contacted','dismissed')),
  created_at       timestamptz default now()
);

alter table public.leads enable row level security;

-- Anyone, signed in or not, can submit a lead — same open-insert
-- posture as public.reports (never shown publicly, admin-reviewed
-- only, so spam risk is low-consequence rather than something that
-- needs a Turnstile check like the public pets table does).
create policy "Anyone can submit a lead"
on public.leads for insert
with check (true);

-- Only admins can read or update leads.
create policy "Admins can view leads"
on public.leads for select
using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

create policy "Admins can update leads"
on public.leads for update
using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

-- ---------- Screenshot storage (optional, spotted_form only) ----------
insert into storage.buckets (id, name, public)
values ('lead-screenshots', 'lead-screenshots', true)
on conflict (id) do nothing;

-- Bucket is public (same as pet-photos/post-images): the public URL
-- serves files regardless of this policy, which only governs the
-- authenticated list/download API path. URLs are unguessable UUIDs,
-- consistent with how the other upload buckets in this repo work.
create policy "Public can view lead screenshots"
on storage.objects for select
using (bucket_id = 'lead-screenshots');

create policy "Anyone can upload a lead screenshot"
on storage.objects for insert
with check (bucket_id = 'lead-screenshots');

-- ---------- Realtime, same pattern as posts/comments ----------
alter publication supabase_realtime add table public.leads;

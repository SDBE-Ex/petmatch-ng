-- =========================================================
-- PetMatch NG — Site health checks
-- Run once in: Supabase Dashboard > SQL Editor > New query
-- Stores results from the automated production/SEO-GEO
-- monitoring loop so they're visible in the admin dashboard
-- instead of only in an unattended cloud agent's transcript.
-- =========================================================

create table public.site_health_checks (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz default now(),
  status             text not null default 'ok' check (status in ('ok','issues_found')),
  breakage_summary   text,
  seo_geo_summary    text,
  fixes_applied      text,
  recommendations    text
);

alter table public.site_health_checks enable row level security;

-- The monitoring loop runs unauthenticated with the anon key, same
-- pattern as public.reports, so it can insert its own check results.
create policy "Anyone can submit a site health check"
on public.site_health_checks for insert
with check (true);

-- Only admins can read past checks.
create policy "Admins can view site health checks"
on public.site_health_checks for select
using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

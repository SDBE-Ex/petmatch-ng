-- =========================================================
-- PetMatch NG — Visit tracking migration #7
-- Run once in: Supabase Dashboard > SQL Editor > New query
-- Adds: an anonymous page_views log (no PII, one row per page load,
-- keyed by a random localStorage-backed session id) and two
-- security-definer RPCs admins use to read aggregated stats without
-- opening direct table access to page_views.
-- =========================================================

create table public.page_views (
  id          uuid primary key default gen_random_uuid(),
  session_id  text not null,
  path        text not null default '/',
  referrer    text,
  created_at  timestamptz default now()
);

alter table public.page_views enable row level security;

-- Anyone, signed in or not, can log a page view
create policy "Anyone can log a page view"
on public.page_views for insert
with check (true);

-- Only admins can read raw rows directly (the RPCs below are the
-- normal path; this is defense in depth, same pattern as reports/admins)
create policy "Admins can view page views"
on public.page_views for select
using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

create index if not exists page_views_created_at_idx on public.page_views (created_at);

-- ---------- Headline stats ----------
create or replace function public.admin_visit_stats()
returns table(
  total_views bigint,
  total_unique_visitors bigint,
  views_today bigint,
  unique_today bigint,
  views_7d bigint,
  unique_7d bigint
)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from public.page_views),
    (select count(distinct session_id) from public.page_views),
    (select count(*) from public.page_views where created_at >= date_trunc('day', now())),
    (select count(distinct session_id) from public.page_views where created_at >= date_trunc('day', now())),
    (select count(*) from public.page_views where created_at >= now() - interval '7 days'),
    (select count(distinct session_id) from public.page_views where created_at >= now() - interval '7 days')
  where exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email');
$$;

grant execute on function public.admin_visit_stats() to authenticated;

-- ---------- Daily breakdown, for a simple bar chart ----------
create or replace function public.admin_visit_daily(days int default 14)
returns table(day date, views bigint, uniques bigint)
language sql
security definer
set search_path = public
as $$
  select date_trunc('day', created_at)::date as day,
         count(*) as views,
         count(distinct session_id) as uniques
  from public.page_views
  where exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email')
    and created_at >= now() - (days || ' days')::interval
  group by 1
  order by 1;
$$;

grant execute on function public.admin_visit_daily(int) to authenticated;

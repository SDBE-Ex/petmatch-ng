-- =========================================================
-- PetMatch NG — Page view language tracking migration
-- Run once in: Supabase Dashboard > SQL Editor > New query
-- Adds a browser_language column to page_views (the same signal
-- browsers use to decide whether to offer translate — see the
-- /updates and other pages' translate hint) and an RPC to summarize
-- it, so "is there real non-English-speaking traffic" has an actual
-- number instead of being a guess.
-- =========================================================

alter table public.page_views add column if not exists browser_language text;

create or replace function public.admin_visit_languages(days int default 30)
returns table(browser_language text, views bigint)
language sql
security definer
set search_path = public
as $$
  select coalesce(nullif(trim(browser_language), ''), 'unknown') as browser_language,
         count(*) as views
  from public.page_views
  where exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email')
    and created_at >= now() - (days || ' days')::interval
  group by 1
  order by 2 desc;
$$;

grant execute on function public.admin_visit_languages(int) to authenticated;

-- =========================================================
-- PetMatch NG — Per-post view counts for the admin Content tab
-- Run once in: Supabase Dashboard > SQL Editor > New query
-- page_views already logs every /updates/{id} hit (api/updates/[id].js
-- now inserts on load, same pattern as index.html/updates.html). This
-- adds the one RPC missing to read it back grouped by post instead of
-- site-wide, same admin-gate pattern as admin_visit_stats/_daily.
-- =========================================================

create or replace function public.admin_visit_by_post(days int default 30)
returns table(path text, views bigint, uniques bigint)
language sql
security definer
set search_path = public
as $$
  select path,
         count(*) as views,
         count(distinct session_id) as uniques
  from public.page_views
  where exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email')
    and path like '/updates/%'
    and created_at >= now() - (days || ' days')::interval
  group by 1
  order by 2 desc;
$$;

grant execute on function public.admin_visit_by_post(int) to authenticated;

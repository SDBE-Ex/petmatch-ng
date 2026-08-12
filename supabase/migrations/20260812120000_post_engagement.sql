-- =========================================================
-- PetMatch NG — Post engagement (comments + likes) migration
-- Run once in: Supabase Dashboard > SQL Editor > New query
-- Comments are open to anyone, no sign-in required (matches how
-- reporting a pet listing already works). Reporting a comment bumps a
-- counter for admins to review rather than exposing a public UPDATE,
-- so a bad actor can't edit someone else's comment via the report path.
-- =========================================================

-- ---------- Comments ----------
create table public.comments (
  id             uuid primary key default gen_random_uuid(),
  post_id        uuid references public.posts(id) on delete cascade not null,
  author_name    text not null check (char_length(author_name) between 1 and 60),
  body           text not null check (char_length(body) between 1 and 1000),
  reported_count integer not null default 0,
  created_at     timestamptz default now()
);

alter table public.comments enable row level security;

create policy "Public can read comments on published posts"
on public.comments for select
using (exists (select 1 from public.posts p where p.id = post_id and p.published = true));

create policy "Admins can read all comments"
on public.comments for select
using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

create policy "Anyone can comment on a published post"
on public.comments for insert
with check (exists (select 1 from public.posts p where p.id = post_id and p.published = true));

create policy "Admins can delete comments"
on public.comments for delete
using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

create or replace function public.report_comment(comment_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.comments set reported_count = reported_count + 1 where id = comment_id;
$$;
grant execute on function public.report_comment(uuid) to anon, authenticated;

-- ---------- Likes ----------
-- A simple counter, not a per-visitor table — there's no visitor
-- identity to key on without requiring sign-in. The client guards
-- against repeat clicks from the same browser via localStorage.
alter table public.posts add column if not exists like_count integer not null default 0;

create or replace function public.like_post(post_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  update public.posts set like_count = like_count + 1 where id = post_id and published = true
  returning like_count;
$$;
grant execute on function public.like_post(uuid) to anon, authenticated;

-- ---------- Realtime ----------
alter publication supabase_realtime add table public.comments;

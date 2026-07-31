-- =========================================================
-- PetMatch NG — Admin panel migration #5
-- Run once in: Supabase Dashboard > SQL Editor > New query
-- Adds: admins allowlist, listing reports, and the RLS policies
-- that let admins moderate listings, partners, and reports.
-- =========================================================

-- ---------- Admins allowlist ----------
-- No insert/update/delete policy is defined on purpose: the only way to
-- add or remove an admin is to run SQL directly in the Supabase dashboard.
-- After running this migration, add yourself with:
--   insert into public.admins (email) values ('you@example.com');
create table public.admins (
  email       text primary key,
  created_at  timestamptz default now()
);

alter table public.admins enable row level security;

-- A signed-in user can check whether *their own* email is an admin
create policy "Admins can read their own admin row"
on public.admins for select
using (email = auth.jwt() ->> 'email');

-- ---------- Reports ----------
create table public.reports (
  id              uuid primary key default uuid_generate_v4(),
  pet_id          uuid references public.pets(id) on delete cascade not null,
  reporter_email  text,
  reason          text not null check (reason in ('Spam','Fake listing','Inappropriate content','Scam or fraud','Other')),
  notes           text,
  status          text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at      timestamptz default now()
);

alter table public.reports enable row level security;

-- Anyone, signed in or not, can report a listing
create policy "Anyone can submit a report"
on public.reports for insert
with check (true);

-- Only admins can see or update reports
create policy "Admins can view reports"
on public.reports for select
using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

create policy "Admins can update reports"
on public.reports for update
using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

-- ---------- Admin moderation of listings ----------
-- Existing owner-only update/delete policies from supabase-schema.sql stay
-- in place; these add admin access on top, so either an owner or an admin
-- can update/delete a listing.
create policy "Admins can update any listing"
on public.pets for update
using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

create policy "Admins can delete any listing"
on public.pets for delete
using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

-- ---------- Admin review of partner applications ----------
-- Existing policy only lets an applicant see their own application by
-- email; this adds full visibility + status changes for admins.
create policy "Admins can view all partner applications"
on public.partner_applications for select
using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

create policy "Admins can update partner applications"
on public.partner_applications for update
using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

-- ---------- Admin-only user directory ----------
-- The anon/authenticated client can never query auth.users directly, so
-- this security-definer function exposes just id/email/created_at, and
-- only to callers whose email is in public.admins.
create or replace function public.admin_list_users()
returns table(id uuid, email text, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select u.id, u.email, u.created_at
  from auth.users u
  where exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email')
  order by u.created_at desc;
$$;

grant execute on function public.admin_list_users() to authenticated;

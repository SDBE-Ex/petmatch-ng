-- =========================================================
-- PetMatch NG -- Subscribers migration #6
-- Adds an explicit opt-in email list, separate from the sign-in
-- email (which is used only for spam prevention, never marketing).
-- =========================================================

create table public.subscribers (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  source      text,
  created_at  timestamptz default now()
);

alter table public.subscribers enable row level security;

-- Anyone can opt in, signed in or not -- this is filled in at the
-- sign-in checkbox, before a session necessarily exists yet.
create policy "Anyone can subscribe"
on public.subscribers for insert
with check (true);

-- Only admins can see the list
create policy "Admins can view subscribers"
on public.subscribers for select
using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

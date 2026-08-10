-- =========================================================
-- PetMatch NG — Posts (admin content) migration
-- Run once in: Supabase Dashboard > SQL Editor > New query
-- Adds a lightweight posts table + image storage bucket so admins can
-- publish updates from admin.html, rendered on the public /updates page.
-- =========================================================

-- ---------- Table ----------
create table public.posts (
  id            uuid primary key default extensions.uuid_generate_v4(),
  title         text not null,
  body          text not null,
  image_url     text,
  link_url      text,
  link_label    text,
  published     boolean not null default false,
  author_email  text,
  created_at    timestamptz default now()
);

alter table public.posts enable row level security;

-- Anyone, signed in or not, can read published posts
create policy "Public can read published posts"
on public.posts for select
using (published = true);

-- Admins can read everything, including unpublished drafts
create policy "Admins can read all posts"
on public.posts for select
using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

create policy "Admins can create posts"
on public.posts for insert
with check (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

create policy "Admins can update posts"
on public.posts for update
using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

create policy "Admins can delete posts"
on public.posts for delete
using (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

-- ---------- Post image storage ----------
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

create policy "Public can view post images"
on storage.objects for select
using (bucket_id = 'post-images');

create policy "Admins can upload post images"
on storage.objects for insert
with check (bucket_id = 'post-images' and exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

create policy "Admins can delete post images"
on storage.objects for delete
using (bucket_id = 'post-images' and exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

-- ---------- Realtime ----------
alter publication supabase_realtime add table public.posts;

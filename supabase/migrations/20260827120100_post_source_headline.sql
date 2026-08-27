-- =========================================================
-- PetMatch NG — Post source headline (content-monitoring "why")
-- Run once in: Supabase Dashboard > SQL Editor > New query
-- The automated weekly content pipeline (pet-trends.yml -> CCR writer
-- -> publish-post.yml) picks a topic from that week's trend headlines
-- but never records which one. This lets build_publish_sql.py forward
-- the matched headline/source URL if the ready JSON includes one, so
-- the admin Content tab can show real provenance instead of nothing.
-- Nullable: existing posts and any manually-authored post (e.g. the
-- Naija Pet Owners launch post) simply won't have one.
-- =========================================================

alter table public.posts add column if not exists source_headline text;
alter table public.posts add column if not exists source_url text;

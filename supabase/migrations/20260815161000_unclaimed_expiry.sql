-- =========================================================
-- PetMatch NG — Auto-expire unclaimed listings
-- Run once in: Supabase Dashboard > SQL Editor > New query
-- Separate from the anonymous-listings migration on purpose: pg_cron
-- must be enabled in Dashboard > Database > Extensions first, and its
-- availability can vary by plan. If that step is skipped, this file
-- fails on its own instead of taking the core listing changes down.
-- =========================================================

create extension if not exists pg_cron with schema extensions;

-- Window is intentionally hardcoded — change it and ship a follow-up
-- migration with `create or replace function` rather than adding a
-- settings table for one numeric knob.
create or replace function public.expire_unclaimed_pets()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.pets
  where owner_id is null
    and created_at < now() - interval '14 days';
$$;

select cron.schedule(
  'expire-unclaimed-pets',
  '0 3 * * *', -- daily at 03:00 UTC
  $$ select public.expire_unclaimed_pets(); $$
);

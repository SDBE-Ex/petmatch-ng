-- =========================================================
-- PetMatch NG — MVP feature migration #3
-- Run once in: Supabase Dashboard > SQL Editor > New query
-- Adds: SMS/text as a third contact-preference option
-- =========================================================

alter table public.pets
  add column if not exists accepts_text boolean not null default false;

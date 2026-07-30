-- =========================================================
-- PetMatch NG — MVP feature migration #2
-- Run once in: Supabase Dashboard > SQL Editor > New query
-- Adds: availability flag, geolocation columns for distance search,
-- and per-owner contact preferences (WhatsApp / calls)
-- =========================================================

alter table public.pets
  add column if not exists available_for_mating boolean not null default true,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists accepts_whatsapp boolean not null default true,
  add column if not exists accepts_calls boolean not null default false;

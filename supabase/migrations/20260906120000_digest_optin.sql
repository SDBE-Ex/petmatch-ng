-- =========================================================
-- PetMatch NG — Match digest opt-in + send log
-- Run once in: Supabase Dashboard > SQL Editor > New query
-- Adds a per-listing opt-in for the weekly "new nearby match" email
-- digest (scripts/digest_send.py), deliberately separate from the
-- existing marketingOptIn/public.subscribers checkbox — that consent
-- covers general PetMatch news, not a behavioral "someone new is
-- nearby" nudge, so it gets its own explicit, default-off opt-in.
-- digest_unsubscribe_token is a private capability token (one-click
-- unsubscribe, no login required) and must never be added to the
-- public column grant, same treatment as owner_email in
-- 20260815163000_owner_email_privacy_v2.sql.
--
-- Neither new column is added to the public.pets column grant at all:
-- the edit-listing UI reads its own rows via the get_my_pets() RPC
-- (SECURITY DEFINER, bypasses the grant entirely — see loadMyPets() in
-- index.html), which already covers "read back my own checkbox state"
-- with no exposure to other browsing users. digest_optin is a private
-- preference, not something another owner needs to see on a listing.
-- =========================================================

alter table public.pets
  add column if not exists digest_optin boolean not null default false,
  add column if not exists digest_unsubscribe_token uuid not null default gen_random_uuid();

-- No-repeat log for the digest: which (recipient pet, matched pet)
-- pairs have already been emailed, so a re-run or a missed week never
-- repeats a match nor silently drops one.
create table if not exists public.digest_sends (
  id                uuid primary key default gen_random_uuid(),
  recipient_pet_id  uuid not null references public.pets(id) on delete cascade,
  matched_pet_id    uuid not null references public.pets(id) on delete cascade,
  sent_at           timestamptz not null default now()
);

create unique index if not exists digest_sends_pair_idx
  on public.digest_sends (recipient_pet_id, matched_pet_id);

alter table public.digest_sends enable row level security;
-- Deliberately no policies: scripts/digest_send.py (service-role key)
-- is the only reader/writer, bypassing RLS entirely. No anon or
-- authenticated access is wanted on this table.

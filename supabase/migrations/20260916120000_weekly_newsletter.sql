-- =========================================================
-- PetMatch NG — Weekly post-summary newsletter
-- Run once in: Supabase Dashboard > SQL Editor > New query
-- Adds one-click unsubscribe to public.subscribers and a no-repeat
-- send log for scripts/weekly_newsletter_send.py.
--
-- Recipients are public.subscribers, not pets.owner_email or a new
-- opt-in: subscribers is already the explicit "Keep me posted about
-- PetMatch news and new features" list (see marketingOptIn in
-- index.html), and a weekly summary of new posts IS PetMatch news —
-- this is the same consent-scope reasoning already applied in
-- 20260906120000_digest_optin.sql (that migration deliberately did
-- NOT reuse subscribers, because a "new match nearby" nudge is a
-- behavioral alert, not general news; this newsletter is the inverse
-- case, so subscribers is the correct list here).
-- =========================================================

alter table public.subscribers
  add column if not exists unsubscribed boolean not null default false,
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

-- No-repeat log: which (subscriber, post) pairs have already been
-- emailed, mirroring public.digest_sends' exact shape/rationale — a
-- missed week never repeats a post, and a subscriber who joins later
-- catches up on not-yet-sent posts on their first send rather than
-- missing history, same "first run surfaces everything" design as
-- the match digest.
create table if not exists public.newsletter_sends (
  id               uuid primary key default gen_random_uuid(),
  subscriber_email text not null,
  post_id          uuid not null references public.posts(id) on delete cascade,
  sent_at          timestamptz not null default now()
);

create unique index if not exists newsletter_sends_pair_idx
  on public.newsletter_sends (subscriber_email, post_id);

alter table public.newsletter_sends enable row level security;
-- Deliberately no policies: scripts/weekly_newsletter_send.py
-- (service-role key) is the only reader/writer, same as digest_sends.

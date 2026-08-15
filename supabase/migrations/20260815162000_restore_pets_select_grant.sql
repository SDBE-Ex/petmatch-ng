-- =========================================================
-- PetMatch NG — Emergency hotfix
-- Run once in: Supabase Dashboard > SQL Editor > New query
-- The column-level grant added in 20260815160000_anonymous_listings.sql
-- broke every "select=*" call against public.pets in production: a
-- SELECT * expands to every column, and Postgres requires privilege on
-- ALL of them to allow it — a partial column grant makes SELECT * fail
-- outright with "permission denied", not gracefully omit the withheld
-- column as assumed. This broke the live public "Find a Match" browse
-- for every visitor immediately on deploy.
--
-- Restoring full table-wide SELECT here to stop the outage. owner_email
-- privacy will be re-applied properly in a follow-up migration, paired
-- with the corresponding frontend change (explicit column lists instead
-- of select('*'), plus a get_my_pets() RPC for the one legitimate case
-- of a signed-in user reading their own owner_email) — not as a
-- database-only change deployed ahead of the code that depends on it.
-- =========================================================

grant select on public.pets to anon, authenticated;

# Staging environment plan

Not yet implemented — sketched 2026-08-15 after a same-day production incident where a
Supabase migration and its matching frontend change had no coordinated way to be tested
together before reaching real users. Vercel (frontend) and this repo's GitHub Actions
workflow (Supabase migrations) are two independent, unsynchronized deploy pipelines with
no staging environment between them and production.

## Shape chosen: persistent staging, not ephemeral per-PR branches

Supabase preview branching (`supabase branches`) is available on this project, and would
give fully automatic per-PR databases — but this site has no build step and no runtime
config-discovery mechanism, so a preview deploy has no way to know which per-PR database
branch to talk to without introducing real new architecture. A single persistent staging
environment gets the actual safety net (test schema + frontend together before prod)
without that redesign. Revisit ephemeral branching if this project grows enough to need
true per-PR isolation.

## 1. Staging Supabase project
- New Supabase project. Replay all existing migrations onto it fresh:
  `supabase link --project-ref <staging-ref>` then `supabase db push`.
- Schema-only — do not copy production data over (real user emails/WhatsApp numbers
  shouldn't sit in a lower-security environment).
- Manually seed one row in `public.admins` so `admin.html` is testable there too.
- **Open question, not yet checked**: whether the current Supabase plan supports a second
  project for free, or has a cost/limit implication. Check before creating it.

## 2. Staging Vercel deployment — no second Vercel project needed
- Push to a `staging` git branch. Vercel already auto-builds any non-`main` branch as a
  preview deployment automatically, at no extra setup.
- Assign a stable domain instead of a random per-commit URL: Vercel dashboard → Project
  Settings → Domains → assign `staging.petmatch.fit` to the `staging` branch.

## 3. The one real code change: hostname-based config
Client-side JS can't read Vercel env vars (static files, no server rendering), so avoid
branch-divergent hardcoded constants (fragile across every merge) — branch on
`location.hostname` instead, in the same source used on both `main` and `staging`:

```js
const IS_STAGING = location.hostname === 'staging.petmatch.fit';
const SUPABASE_URL = IS_STAGING ? '<staging-project-url>' : 'https://pnawdtpavemfjzdsevey.supabase.co';
const SUPABASE_ANON_KEY = IS_STAGING ? '<staging-anon-key>' : 'sb_publishable_...';
```

Same commit is correct on both domains — nothing to keep in sync across branches.

Applies everywhere `SUPABASE_URL`/`SUPABASE_ANON_KEY` are currently hardcoded:
`index.html`, `admin.html`, `api/pets/[id].js`, `api/sitemap.js`, `api/updates/[id].js`.
Also update `TURNSTILE_SITE_KEY` in `index.html` the same way once a staging Turnstile
widget exists (or reuse the production widget's site key for staging — lower stakes).

## 4. Server-side (`api/`) needs zero new code
Vercel already supports different values for the same env var name per environment
(Production vs. Preview). Add a Preview-scoped value for each secret, pointing at
staging's credentials:
```
vercel env add TURNSTILE_SECRET_KEY preview
vercel env add SUPABASE_SERVICE_ROLE_KEY preview
```
`process.env.X` in `api/pets/create.js` already resolves correctly per environment with
no code change — this is purely a `vercel env add` step.

## 5. GitHub Actions: one more job in the existing workflow
Extend `.github/workflows/supabase-migrations.yml` (currently only triggers on `main`):
- Push to `staging` touching `supabase/migrations/**` → `supabase link --project-ref
  <staging-ref>` → `supabase db push --linked` (apply to staging).
- Push to `main` → existing behavior, unchanged, applies to production.
- Likely the same `SUPABASE_ACCESS_TOKEN` secret works for both if staging and production
  are in the same Supabase org — confirm when setting this up.

## The resulting workflow
Feature branch → merge into `staging` → Vercel + GitHub Actions auto-deploy the matching
frontend+database pair → click-through test on `staging.petmatch.fit` → merge `staging`
into `main` → production, now proven together first instead of two independent leaps of
faith landing in an unpredictable order (which is exactly what caused today's incident).

## Also already done today, related
- `.env.example` at repo root documents the required secrets (Vercel env vars +
  the separate `SUPABASE_ACCESS_TOKEN` GitHub Actions secret).
- `scripts/check-migrations.sh`'s header comment is stale — it says migrations
  "are not auto-applied on push/deploy," which predates the GitHub Actions workflow that
  now does exactly that on `main`. Worth a quick fix whenever touching that script next.

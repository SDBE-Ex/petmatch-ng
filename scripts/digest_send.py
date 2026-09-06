#!/usr/bin/env python3
"""Weekly "new nearby match" email digest — the first real re-engagement
loop on PetMatch (today, an owner lists a pet and other owners have to
browse and find it themselves; nothing tells anyone a new match showed
up). Chosen after a codebase audit found no AI or automated engagement
loop anywhere in the repo.

Recipients are pets.owner_email where digest_optin=true — a new,
specific, default-off opt-in (see supabase/migrations/
20260906120000_digest_optin.sql), deliberately separate from the
existing general marketingOptIn/public.subscribers checkbox, since a
behavioral "someone new is nearby" nudge is a real step beyond "PetMatch
news." Waitlist leads (public.leads) are out of scope for v1: no email
column, and no equivalent consent captured there.

Sends via Resend's plain REST API (no SDK — matches every other script
in this repo, which is stdlib-only). Requires SUPABASE_SERVICE_ROLE_KEY
(owner_email, digest_optin, and digest_unsubscribe_token are all absent
from the public column grant, by design — see the migration above and
20260815163000_owner_email_privacy_v2.sql) and RESEND_API_KEY, both as
GitHub Actions secrets (a separate secrets store from Vercel's env
vars — see .env.example).

No-repeat tracking is a database log (public.digest_sends), not a time
window: it survives a missed cron run without either repeating a match
or silently dropping one, and needs no "last digest sent" bookkeeping.
A pet's very first run will surface every current match at once — by
design at this scale, not a bug.

Set DRY_RUN=1 to compose and log emails without calling Resend or
writing digest_sends. Always run with DRY_RUN=1 first after any change.
"""
import json
import math
import os
import sys
import urllib.error
import urllib.request

SUPABASE_URL = "https://pnawdtpavemfjzdsevey.supabase.co"
FROM_ADDRESS = "PetMatch <matches@send.petmatch.fit>"  # send.petmatch.fit is the Resend-verified sending domain (verified 2026-08-08, region eu-west-1)
NEARBY_KM = 100  # haversine threshold when both pets have lat/lng
MAX_MATCHES_PER_PET = 5  # per pet section in one email, keeps a digest readable
MAX_EMAILS_PER_RUN = 30  # pre-scale safety valve — this site has ~13 users total as of writing

SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
DRY_RUN = os.environ.get("DRY_RUN", "1").lower() in ("1", "true", "yes")

PETS_COLUMNS = (
    "id,owner_email,pet_name,species,gender,state,lat,lng,"
    "available_for_mating,digest_optin,digest_unsubscribe_token,created_at"
)


def supabase_get(path):
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{path}",
        headers={"apikey": SERVICE_ROLE_KEY, "Authorization": f"Bearer {SERVICE_ROLE_KEY}"},
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def supabase_post(path, row):
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{path}",
        method="POST",
        headers={
            "apikey": SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        data=json.dumps(row).encode("utf-8"),
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.status


def haversine_km(lat1, lng1, lat2, lng2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def is_nearby(a, b):
    if a.get("lat") is not None and a.get("lng") is not None and b.get("lat") is not None and b.get("lng") is not None:
        return haversine_km(a["lat"], a["lng"], b["lat"], b["lng"]) <= NEARBY_KM
    return a.get("state") and b.get("state") and a["state"] == b["state"]


def rank_key(recipient, candidate):
    # Neutral matching (species + nearby) surfaces everyone; this only
    # orders a mating-intent match first for pets that actually signalled
    # it, rather than presuming every recipient wants that framing.
    mating_signal = (
        recipient.get("available_for_mating")
        and candidate.get("available_for_mating")
        and recipient.get("gender") != candidate.get("gender")
    )
    return (0 if mating_signal else 1, candidate.get("created_at") or "")


def find_matches(recipient, all_pets, already_sent):
    candidates = []
    for c in all_pets:
        if c["id"] == recipient["id"]:
            continue
        if c["owner_email"] == recipient["owner_email"]:
            continue  # never match an owner against their own other listings
        if c["species"] != recipient["species"]:
            continue
        if (recipient["id"], c["id"]) in already_sent:
            continue
        if not is_nearby(recipient, c):
            continue
        candidates.append(c)
    candidates.sort(key=lambda c: rank_key(recipient, c))
    return candidates[:MAX_MATCHES_PER_PET]


def render_email(owner_email, sections):
    # sections: list of (recipient_pet, matches[])
    blocks = []
    for pet, matches in sections:
        match_items = "".join(
            f'<li style="margin-bottom:10px"><a href="https://petmatch.fit/pets/{m["id"]}">'
            f'{m["pet_name"]}</a> — {m["species"]}, {m["state"]}</li>'
            for m in matches
        )
        unsubscribe_url = f"https://petmatch.fit/digest/unsubscribe?token={pet['digest_unsubscribe_token']}"
        blocks.append(
            f'<h3 style="font-family:sans-serif;color:#132E20">New matches for {pet["pet_name"]}</h3>'
            f'<ul style="font-family:sans-serif;padding-left:20px">{match_items}</ul>'
            f'<p style="font-family:sans-serif;font-size:12px;color:#8a7f65">'
            f'<a href="{unsubscribe_url}">Stop these emails for {pet["pet_name"]}</a></p>'
        )
    html = (
        '<div style="font-family:sans-serif;max-width:480px;margin:0 auto">'
        '<h2 style="font-family:sans-serif;color:#132E20">New nearby matches on PetMatch</h2>'
        + "".join(blocks)
        + '</div>'
    )
    # RFC 8058 one-click header — one link per email, so if an owner has
    # multiple opted-in pets this uses the first pet's unsubscribe token.
    # Individual per-pet unsubscribe links are also in the body above.
    primary_token = sections[0][0]["digest_unsubscribe_token"]
    list_unsubscribe = f"<https://petmatch.fit/digest/unsubscribe?token={primary_token}>"
    return html, list_unsubscribe


def send_email(to_email, html, list_unsubscribe):
    body = {
        "from": FROM_ADDRESS,
        "to": [to_email],
        "subject": "New nearby matches on PetMatch",
        "html": html,
        "headers": {"List-Unsubscribe": list_unsubscribe, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"},
    }
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        method="POST",
        headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
        data=json.dumps(body).encode("utf-8"),
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.status


def main():
    if not SERVICE_ROLE_KEY:
        print("SUPABASE_SERVICE_ROLE_KEY is not set.", file=sys.stderr)
        return 1
    if not DRY_RUN and not RESEND_API_KEY:
        print("RESEND_API_KEY is not set (required for a real, non-dry-run send).", file=sys.stderr)
        return 1

    all_pets = supabase_get(f"pets?select={PETS_COLUMNS}")
    sends = supabase_get("digest_sends?select=recipient_pet_id,matched_pet_id")
    already_sent = {(s["recipient_pet_id"], s["matched_pet_id"]) for s in sends}

    recipients = [p for p in all_pets if p.get("digest_optin")]
    print(f"{len(recipients)} opted-in pet(s), {len(all_pets)} total pet(s), {len(already_sent)} prior send(s) logged.")

    by_owner = {}
    for pet in recipients:
        matches = find_matches(pet, all_pets, already_sent)
        if matches:
            by_owner.setdefault(pet["owner_email"], []).append((pet, matches))

    sent_count = 0
    for owner_email, sections in by_owner.items():
        if sent_count >= MAX_EMAILS_PER_RUN:
            print(f"Hit MAX_EMAILS_PER_RUN={MAX_EMAILS_PER_RUN}, stopping this run early.")
            break

        html, list_unsubscribe = render_email(owner_email, sections)
        pair_count = sum(len(m) for _, m in sections)

        if DRY_RUN:
            print(f"[DRY RUN] Would email {owner_email}: {pair_count} match(es) across {len(sections)} listing(s).")
            continue

        try:
            send_email(owner_email, html, list_unsubscribe)
        except (urllib.error.URLError, urllib.error.HTTPError) as e:
            print(f"Failed to send to {owner_email}: {e}", file=sys.stderr)
            continue

        for pet, matches in sections:
            for m in matches:
                try:
                    supabase_post("digest_sends", {"recipient_pet_id": pet["id"], "matched_pet_id": m["id"]})
                except (urllib.error.URLError, urllib.error.HTTPError) as e:
                    # Send already went out; a failed log write here just means
                    # this one pair might repeat next run, not a double-send.
                    print(f"Sent to {owner_email} but failed to log digest_sends row: {e}", file=sys.stderr)

        sent_count += 1
        print(f"Sent to {owner_email}: {pair_count} match(es) across {len(sections)} listing(s).")

    print(f"Done. {sent_count} email(s) {'would be ' if DRY_RUN else ''}sent.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

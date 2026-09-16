#!/usr/bin/env python3
"""Weekly email digest of new PetMatch blog posts, sent to
public.subscribers — the second automated email PetMatch sends (the
first, scripts/digest_send.py, is the personalized "new nearby match"
alert to opted-in pet owners; this one is a content newsletter).

Recipients are public.subscribers, deliberately not a new opt-in:
subscribers is already the explicit "Keep me posted about PetMatch
news and new features" checkbox (see marketingOptIn in index.html),
and a weekly summary of new posts IS PetMatch news. This is the mirror
case of the reasoning in supabase/migrations/20260906120000_digest_optin.sql
(which deliberately did NOT reuse subscribers, since a "new match
nearby" alert is a behavioral nudge, not general news) — see
20260916120000_weekly_newsletter.sql for the full note.

No-repeat tracking is a database log (public.newsletter_sends), same
shape as public.digest_sends: never repeats a post to a subscriber
who's already seen it, and a subscriber who joins after several posts
have gone out gets caught up on all of them on their first send rather
than missing history — by design at this scale, not a bug, same
philosophy already used for the match digest.

Snippets reuse this repo's own established truncation convention
(plain-text, character-sliced — see api/updates/[id].js's meta
description and api/pets/[id].js's) rather than inventing a new rule,
at 200 chars instead of that precedent's 300, since several post
snippets appear together in one email and need to stay skimmable.

Sends via Resend's plain REST API (no SDK, matching every script in
this repo). Requires SUPABASE_SERVICE_ROLE_KEY (subscribers has no
anon/authenticated SELECT policy at all — admin-only, see
20260731213000_subscribers.sql) and RESEND_API_KEY, both already
configured as GitHub Actions secrets for scripts/digest_send.py — no
new secrets needed.

Set DRY_RUN=1 to compose and log emails without calling Resend or
writing newsletter_sends. Always run with DRY_RUN=1 first after any
change.
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request

SUPABASE_URL = "https://pnawdtpavemfjzdsevey.supabase.co"
FROM_ADDRESS = "PetMatch <matches@send.petmatch.fit>"  # same Resend-verified sending domain as scripts/digest_send.py
SNIPPET_CHARS = 200
MAX_POSTS_PER_EMAIL = 5  # keeps a catch-up email readable for a subscriber who joined late
MAX_EMAILS_PER_RUN = 100  # pre-scale safety valve

SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
DRY_RUN = os.environ.get("DRY_RUN", "1").lower() in ("1", "true", "yes")

POSTS_COLUMNS = "id,title,body,image_url,created_at"
SUBSCRIBERS_COLUMNS = "email,unsubscribed,unsubscribe_token"


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


def snippet(body):
    plain = re.sub(r"\s+", " ", body or "").strip()
    if len(plain) <= SNIPPET_CHARS:
        return plain
    return plain[:SNIPPET_CHARS].rsplit(" ", 1)[0] + "…"


def render_email(subscriber, posts):
    unsubscribe_url = f"https://petmatch.fit/newsletter/unsubscribe?token={subscriber['unsubscribe_token']}"
    items = "".join(
        f'<div style="margin-bottom:20px">'
        f'<h3 style="font-family:sans-serif;color:#132E20;margin:0 0 6px">'
        f'<a href="https://petmatch.fit/updates/{p["id"]}" style="color:#132E20;text-decoration:none">{p["title"]}</a></h3>'
        f'<p style="font-family:sans-serif;color:#3c3628;margin:0">{snippet(p["body"])}</p>'
        f'</div>'
        for p in posts
    )
    html = (
        '<div style="font-family:sans-serif;max-width:480px;margin:0 auto">'
        '<h2 style="font-family:sans-serif;color:#132E20">New from PetMatch this week</h2>'
        + items
        + f'<p style="font-family:sans-serif;font-size:12px;color:#8a7f65">'
        f'<a href="{unsubscribe_url}">Unsubscribe from PetMatch news</a></p>'
        '</div>'
    )
    list_unsubscribe = f"<{unsubscribe_url}>"
    return html, list_unsubscribe


def send_email(to_email, html, list_unsubscribe):
    body = {
        "from": FROM_ADDRESS,
        "to": [to_email],
        "subject": "New from PetMatch this week",
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

    all_subscribers = supabase_get(f"subscribers?select={SUBSCRIBERS_COLUMNS}")
    all_posts = supabase_get(f"posts?select={POSTS_COLUMNS}&published=eq.true&order=created_at.asc")
    sends = supabase_get("newsletter_sends?select=subscriber_email,post_id")
    already_sent = {(s["subscriber_email"], s["post_id"]) for s in sends}

    active_subscribers = [s for s in all_subscribers if not s.get("unsubscribed")]
    print(f"{len(active_subscribers)} active subscriber(s), {len(all_posts)} published post(s), {len(already_sent)} prior send(s) logged.")

    sent_count = 0
    for sub in active_subscribers:
        if sent_count >= MAX_EMAILS_PER_RUN:
            print(f"Hit MAX_EMAILS_PER_RUN={MAX_EMAILS_PER_RUN}, stopping this run early.")
            break

        unsent = [p for p in all_posts if (sub["email"], p["id"]) not in already_sent]
        if not unsent:
            continue
        posts_to_send = unsent[:MAX_POSTS_PER_EMAIL]

        html, list_unsubscribe = render_email(sub, posts_to_send)

        if DRY_RUN:
            print(f"[DRY RUN] Would email {sub['email']}: {len(posts_to_send)} post(s).")
            continue

        try:
            send_email(sub["email"], html, list_unsubscribe)
        except (urllib.error.URLError, urllib.error.HTTPError) as e:
            print(f"Failed to send to {sub['email']}: {e}", file=sys.stderr)
            continue

        for p in posts_to_send:
            try:
                supabase_post("newsletter_sends", {"subscriber_email": sub["email"], "post_id": p["id"]})
            except (urllib.error.URLError, urllib.error.HTTPError) as e:
                # Send already went out; a failed log write here just means
                # this one post might repeat next run, not a double-send.
                print(f"Sent to {sub['email']} but failed to log newsletter_sends row: {e}", file=sys.stderr)

        sent_count += 1
        print(f"Sent to {sub['email']}: {len(posts_to_send)} post(s).")

    print(f"Done. {sent_count} email(s) {'would be ' if DRY_RUN else ''}sent.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

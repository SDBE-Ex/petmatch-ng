#!/usr/bin/env python3
"""Track which of the 8 curated post images have been used recently, so
the external "PetMatch Content Writer" cloud routine can avoid repeats.

That routine (not in this repo) picks content/images/manifest.json's
best-fitting entry by topic/species every time it drafts a weekly
article, with no memory of what it picked last time. The manifest has
only 8 images total (2 of them cat-tagged), so repeats are a near
certainty as more posts accumulate — nothing today tracks usage at all.

The routine's sandbox can't query Supabase directly (same reason
pet-trends.yml exists: it has no real network access), so — same
pattern as that file — this script writes a plain committed file the
routine reads as grounding data, rather than making the pick itself.
It hands over facts (which images were used when), not a decision.

Primary source is this repo's own committed draft files
(content/submitted/*.json, content/published/*.json), which are date-
prefixed (e.g. 2026-08-26-how-to-vet-a-breeder-listing.json) and cover
every draft regardless of admin-approval status. A Supabase query alone
would miss anything still sitting unapproved (published=false), since
public.posts only grants anon-key SELECT where published=true (see
20260809140000_posts.sql) — so a second, defense-in-depth check against
already-published posts is added on top, to catch a post typed by hand
directly into admin.html, outside this JSON pipeline entirely.
"""
import glob
import json
import os
import re
import urllib.error
import urllib.request
from datetime import date, datetime

SUPABASE_URL = "https://pnawdtpavemfjzdsevey.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_CHwFvmImO-SxEMDO52uWeA_WUuU1k2l"

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST_PATH = os.path.join(REPO_ROOT, "content", "images", "manifest.json")
OUTPUT_PATH = os.path.join(REPO_ROOT, "content", "images", "recently-used.json")
DATE_PREFIX_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})-")


def local_usage():
    """image_url -> most recent 'used on' date, from committed draft files."""
    usage = {}
    for pattern in ("content/submitted/*.json", "content/published/*.json"):
        for path in glob.glob(os.path.join(REPO_ROOT, pattern)):
            filename = os.path.basename(path)
            m = DATE_PREFIX_RE.match(filename)
            if not m:
                continue
            used_date = m.group(1)
            try:
                with open(path, encoding="utf-8") as f:
                    draft = json.load(f)
            except (json.JSONDecodeError, OSError):
                continue
            image_url = draft.get("image_url")
            if not image_url:
                continue
            if image_url not in usage or used_date > usage[image_url]:
                usage[image_url] = used_date
    return usage


def supabase_usage():
    """Defense-in-depth: image_url -> most recent created_at date, for
    already-published posts, straight from Supabase. Catches a post
    typed directly into admin.html that never passed through the JSON
    pipeline above."""
    url = (
        f"{SUPABASE_URL}/rest/v1/posts"
        "?select=image_url,created_at&published=eq.true&image_url=not.is.null"
        "&order=created_at.desc&limit=50"
    )
    req = urllib.request.Request(url, headers={"apikey": SUPABASE_ANON_KEY})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            rows = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
        print(f"Supabase usage check failed (non-fatal, continuing with local data only): {e}")
        return {}

    usage = {}
    for row in rows:
        image_url = row.get("image_url")
        created_at = row.get("created_at")
        if not image_url or not created_at:
            continue
        used_date = created_at[:10]  # ISO date prefix
        if image_url not in usage or used_date > usage[image_url]:
            usage[image_url] = used_date
    return usage


def weeks_since(used_date_str, today):
    used = datetime.strptime(used_date_str, "%Y-%m-%d").date()
    return (today - used).days // 7


def main():
    with open(MANIFEST_PATH, encoding="utf-8") as f:
        manifest = json.load(f)

    usage = local_usage()
    for image_url, used_date in supabase_usage().items():
        if image_url not in usage or used_date > usage[image_url]:
            usage[image_url] = used_date

    today = date.today()
    entries = []
    for img in manifest["images"]:
        last_used = usage.get(img["url"])
        entries.append({
            "file": img["file"],
            "url": img["url"],
            "tags": img["tags"],
            "last_used_date": last_used,
            "weeks_since_used": weeks_since(last_used, today) if last_used else None,
        })

    output = {
        "_comment": (
            "Facts only, not a pre-made pick: images used in roughly the last "
            "4 weeks should generally be avoided unless nothing else in "
            "manifest.json actually fits this week's topic/species. "
            "weeks_since_used: null means never used yet, so it's always a "
            "safe first choice. Generated by scripts/build_recently_used_images.py."
        ),
        "generated_at": today.isoformat(),
        "images": entries,
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
        f.write("\n")

    print(f"Wrote {OUTPUT_PATH}")
    for e in entries:
        print(f"  {e['file']:<28} last used: {e['last_used_date'] or 'never'}")


if __name__ == "__main__":
    main()

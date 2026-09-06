#!/usr/bin/env python3
"""Detect a silently-missed weekly content post before it goes unnoticed
for weeks.

publish-post.yml uses `shopt -s nullglob; for draft in content/ready/*.json`.
If the external "PetMatch Content Writer" cloud routine never wrote a
draft that week, that loop body simply never runs — DRAFT_SUMMARY stays
empty, the `gh issue create` step is gated behind
`if: steps.submit.outputs.summary != ''` and never fires either, and the
workflow run finishes green with zero visible signal. Nothing before
this script would tell anyone the pipeline quietly did nothing.

No network call here on purpose: an anon-key Supabase query can't even
see draft posts (public.posts only grants SELECT where published=true,
see 20260809140000_posts.sql), so it's not a usable signal for this
check anyway — this repo's own committed content/ files are strictly
better ground truth, and require no credentials at all.

Exit 0 if a draft was produced recently enough; exit 1 (with a stage
diagnosis) otherwise. Intended to run a day after publish-post.yml's
own Wednesday cron, via content-pipeline-watchdog.yml.
"""
import glob
import os
import re
import sys
from datetime import date, timedelta

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATE_PREFIX_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})-")
LOOKBACK_DAYS = 8  # a week's cadence plus a day of slack


def recent_dated_files(stage, cutoff):
    files = []
    for path in glob.glob(os.path.join(REPO_ROOT, "content", stage, "*.json")):
        filename = os.path.basename(path)
        m = DATE_PREFIX_RE.match(filename)
        if not m:
            continue
        file_date = date.fromisoformat(m.group(1))
        if file_date >= cutoff:
            files.append(filename)
    return files


def main():
    cutoff = date.today() - timedelta(days=LOOKBACK_DAYS)

    submitted = recent_dated_files("submitted", cutoff)
    published = recent_dated_files("published", cutoff)
    ready = recent_dated_files("ready", cutoff)

    if submitted or published:
        print(f"OK: found a recent draft — submitted={submitted or 'none'} published={published or 'none'}")
        return 0

    if ready:
        print(
            "FAIL: a draft exists in content/ready/ "
            f"({ready}) but never moved to content/submitted/ — "
            "publish-post.yml likely failed partway through (it would "
            "also show as its own red run in Actions)."
        )
        return 1

    print(
        f"FAIL: no draft dated in the last {LOOKBACK_DAYS} days in "
        "content/ready/, content/submitted/, or content/published/ — "
        "the 'PetMatch Content Writer' cloud routine most likely did not "
        "run this week."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())

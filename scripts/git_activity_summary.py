#!/usr/bin/env python3
"""Summarize recent git activity so a human or an agent picking up this
repo cold can see, at a glance, what changed recently and where two
authors touched the same file close together in time.

This repo is edited by more than one Claude session plus a couple of
GitHub Actions bots (funnel-check, pet-trends, publish-post), all
committing straight to main with no staging environment (see
STAGING_PLAN.md). On 2026-09-01 that nearly caused a silent content
regression: a local branch and a same-day upstream commit both edited
index.html's FAQ section, and only manually grepping `git log` caught
it before push. This script is that manual step, automated.

Read-only. Does not call git in a way that mutates anything, and does
not touch Supabase, Vercel, or any network endpoint.

Usage:
  python3 scripts/git_activity_summary.py [--days N] [--top N]
"""
import argparse
import subprocess
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone

FIELD_SEP = "\x1f"


def run_git_log(since_iso):
    fmt = FIELD_SEP.join(["%H", "%ad", "%an", "%s"])
    out = subprocess.run(
        [
            "git", "log", f"--since={since_iso}",
            f"--pretty=format:{fmt}",
            "--date=iso-strict",
            "--name-only",
        ],
        capture_output=True, text=True, check=True,
    )
    return out.stdout


def parse_commits(raw):
    # Header lines are the only ones containing FIELD_SEP; every other
    # non-blank line between two headers is a file touched by the commit
    # whose header preceded it.
    commits = []
    current = None
    for line in raw.split("\n"):
        if FIELD_SEP in line:
            if current is not None:
                commits.append(current)
            sha, date, author, subject = line.split(FIELD_SEP)
            current = {"sha": sha[:9], "date": date, "author": author, "subject": subject, "files": []}
        elif line.strip() and current is not None:
            current["files"].append(line.strip())
    if current is not None:
        commits.append(current)
    return commits


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--days", type=int, default=14, help="Look-back window in days (default: 14)")
    ap.add_argument("--top", type=int, default=8, help="How many collision-risk files to show (default: 8)")
    args = ap.parse_args()

    since = datetime.now(timezone.utc) - timedelta(days=args.days)
    raw = run_git_log(since.strftime("%Y-%m-%d"))
    commits = parse_commits(raw)

    if not commits:
        print(f"No commits in the last {args.days} day(s).")
        return

    print(f"== Git activity, last {args.days} day(s): {len(commits)} commit(s) ==\n")

    by_author = defaultdict(int)
    file_touches = defaultdict(list)  # file -> list of (date, sha, subject, author)
    for c in commits:
        by_author[c["author"]] += 1
        for f in c["files"]:
            file_touches[f].append((c["date"], c["sha"], c["subject"], c["author"]))

    print("-- By author --")
    for author, n in sorted(by_author.items(), key=lambda kv: -kv[1]):
        print(f"  {n:>3}  {author}")

    print("\n-- Recent commits (newest first) --")
    for c in commits:
        day = c["date"][:10]
        print(f"  {day}  {c['sha']}  {c['author']:<20} {c['subject']}")

    # Collision risk: files touched by more than one commit, especially
    # by more than one distinct author, within the window.
    risky = []
    for f, touches in file_touches.items():
        if len(touches) < 2:
            continue
        authors = {t[3] for t in touches}
        risky.append((len(touches), len(authors), f, touches))
    risky.sort(key=lambda t: (-t[1], -t[0]))

    if risky:
        print(f"\n-- Files touched more than once ({min(len(risky), args.top)} of {len(risky)} shown) --")
        print("   (multiple authors on the same file in a short window is exactly")
        print("    the shape that caused a same-day conflict on 2026-09-01)")
        for count, n_authors, f, touches in risky[: args.top]:
            marker = " <-- multiple authors" if n_authors > 1 else ""
            print(f"  {f}  ({count} commits, {n_authors} author(s)){marker}")
            for date, sha, subject, author in touches:
                print(f"      {date[:10]}  {sha}  {author:<20} {subject}")
    else:
        print("\nNo file was touched by more than one commit in this window.")

    print(
        "\nTip: before pushing a branch that's been open a while, run "
        "`git fetch origin && git log HEAD..origin/main --stat` to see what "
        "landed upstream while you were working, the same check that caught "
        "the 2026-09-01 conflict."
    )


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as e:
        print(f"git command failed: {e}", file=sys.stderr)
        sys.exit(1)

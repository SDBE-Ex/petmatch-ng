#!/usr/bin/env python3
"""Catch the "FAQPage JSON-LD claims a question exists, but no crawler
can actually read it as static text" bug before it ships.

This exact bug shipped twice: about.html (fixed in 2da2b27) and
index.html, where the visible FAQ was shrunk to a link-out teaser in
74bd8bd while the JSON-LD kept claiming five full Q&As, restored in
ad81007. The established fix in this repo is not "delete the JSON-LD"
or "delete the JS widget" — it's "make sure the same question also has
a plain, unconditional static counterpart on the page."

This script checks one thing only: for every FAQPage "name" (the
question) in a page's JSON-LD, does that question text also appear
somewhere in the page's HTML outside of a <script> tag? It does not
require the answer text to match verbatim, since a shorter visible
answer that links out to /safety for the full reasoning (see faq.html,
about.html) is a legitimate, already-used pattern here, not a bug.

Read-only, no writes anywhere (unlike site_health_check.py, this does
not insert into Supabase) — safe to run against production or a local
dev server at any time.

Usage:
  python3 scripts/check_faq_crawlable.py                  # checks production
  python3 scripts/check_faq_crawlable.py --base-url http://localhost:5500
"""
import argparse
import json
import re
import sys
import urllib.error
import urllib.request

ROUTES = ["/", "/about", "/faq", "/compare", "/safety", "/partners"]
JSONLD_RE = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)
SCRIPT_RE = re.compile(r"<script\b[^>]*>.*?</script>", re.S | re.I)
TAG_RE = re.compile(r"<[^>]+>")


def fetch(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": "PetMatch-FaqCrawlableCheck/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read().decode("utf-8", errors="replace")


def normalize(text):
    return re.sub(r"\s+", " ", text).strip().lower()


def faq_questions(html):
    questions = []
    for block in JSONLD_RE.findall(html):
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            continue
        entities = data.get("mainEntity") if isinstance(data, dict) else None
        if not entities:
            continue
        if isinstance(entities, dict):
            entities = [entities]
        for entity in entities:
            name = entity.get("name")
            if entity.get("@type") == "Question" and name:
                questions.append(name)
    return questions


def check_route(base_url, path):
    url = f"{base_url}{path}"
    try:
        status, html = fetch(url)
    except urllib.error.HTTPError as e:
        return path, None, f"HTTP {e.code}"
    except Exception as e:
        return path, None, str(e)
    if status != 200:
        return path, None, f"HTTP {status}"

    questions = faq_questions(html)
    if not questions:
        return path, [], None  # no FAQPage schema on this route, nothing to check

    stripped = SCRIPT_RE.sub(" ", html)
    visible_text = normalize(TAG_RE.sub(" ", stripped))

    missing = [q for q in questions if normalize(q) not in visible_text]
    return path, missing, None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base-url", default="https://petmatch.fit", help="Base URL to check (default: production)")
    args = ap.parse_args()
    base_url = args.base_url.rstrip("/")

    any_issue = False
    for path in ROUTES:
        route_path, missing, error = check_route(base_url, path)
        if error:
            print(f"  SKIP  {path:<12} {error}")
            continue
        if missing is None:
            continue
        if not missing:
            print(f"  OK    {path}")
        else:
            any_issue = True
            print(f"  FAIL  {path}")
            for q in missing:
                print(f"          Not found as static text outside <script>: {q!r}")

    if any_issue:
        print(
            "\nOne or more FAQPage questions exist only inside JSON-LD (or only "
            "inside a JS-revealed widget), with no static counterpart in the "
            "page. Add plain visible text for the question, the way faq.html "
            "and about.html already do."
        )
        sys.exit(1)
    print("\nAll FAQPage questions have a static, crawlable counterpart.")


if __name__ == "__main__":
    main()

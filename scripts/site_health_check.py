#!/usr/bin/env python3
"""Mechanical site-health check: key routes return 200 with valid
JSON-LD, and sitemap.xml is valid + non-empty. Inserts one row into
public.site_health_checks via the Supabase REST API (same open-insert
policy the admin panel's "Check now" button and the previous cloud-
routine checks already use — see the panel-sitehealth section of
admin.html for the mirrored client-side version of this same check).

Runs from .github/workflows/site-health.yml, which has real network
access to petmatch.fit and Supabase — the paired "PetMatch Site
Health" cloud routine's sandbox does not (see project memory), so its
"last checked" date only moved when it happened to run somewhere that
did have access. This is the recurring safety net that doesn't depend
on that, or on someone remembering to click the manual button.
"""
import json
import re
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET

SUPABASE_URL = "https://pnawdtpavemfjzdsevey.supabase.co"
SUPABASE_ANON_KEY = "sb_publishable_CHwFvmImO-SxEMDO52uWeA_WUuU1k2l"

ROUTES = ["/", "/about", "/faq", "/compare", "/safety", "/partners", "/updates"]
JSONLD_RE = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)


def fetch(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": "PetMatch-SiteHealthCheck/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read().decode("utf-8", errors="replace")


def check_route(path):
    url = f"https://petmatch.fit{path}"
    try:
        status, body = fetch(url)
    except urllib.error.HTTPError as e:
        return path, False, f"HTTP {e.code}"
    except Exception as e:
        return path, False, str(e)
    if status != 200:
        return path, False, f"HTTP {status}"
    for block in JSONLD_RE.findall(body):
        try:
            json.loads(block)
        except json.JSONDecodeError as e:
            return path, False, f"Invalid JSON-LD ({e})"
    return path, True, None


def check_sitemap():
    try:
        status, body = fetch("https://petmatch.fit/sitemap.xml")
    except Exception as e:
        return False, str(e), 0
    if status != 200:
        return False, f"HTTP {status}", 0
    try:
        root = ET.fromstring(body)
    except ET.ParseError as e:
        return False, f"Does not parse as valid XML ({e})", 0
    count = len(root.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}url"))
    if count == 0:
        return False, "Parses but contains 0 URLs", 0
    return True, f"{count} URLs", count


def main():
    route_results = [check_route(p) for p in ROUTES]
    broken = [(p, note) for p, ok, note in route_results if not ok]
    sitemap_ok, sitemap_note, _ = check_sitemap()

    issues = [f"{p}: {note}" for p, note in broken]
    if not sitemap_ok:
        issues.append(f"sitemap.xml: {sitemap_note}")

    breakage_summary = (
        "; ".join(issues) if issues
        else f"All {len(ROUTES)} key routes returned 200 with valid JSON-LD."
    )
    seo_geo_summary = f"sitemap.xml valid, {sitemap_note}." if sitemap_ok else f"sitemap.xml issue: {sitemap_note}."
    status = "issues_found" if issues else "ok"

    row = {
        "status": status,
        "breakage_summary": breakage_summary,
        "seo_geo_summary": seo_geo_summary,
        "fixes_applied": "Automated recurring check (GitHub Actions) — read-only, no fixes applied.",
        "recommendations": "Review the routes/sitemap listed under Breakage above." if issues else "No issues found.",
    }

    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/site_health_checks",
        method="POST",
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        data=json.dumps(row).encode("utf-8"),
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            print(f"Inserted site_health_checks row, status={status}, HTTP {resp.status}")
    except urllib.error.HTTPError as e:
        print(f"Failed to insert row: HTTP {e.code} {e.read().decode(errors='replace')}", file=sys.stderr)
        sys.exit(1)

    print(breakage_summary)
    print(seo_geo_summary)
    if issues:
        sys.exit(1)  # non-zero so a broken check shows up as a red run, not just a quiet row


if __name__ == "__main__":
    main()

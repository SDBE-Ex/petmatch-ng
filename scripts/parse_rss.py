#!/usr/bin/env python3
"""Parse a Google News RSS feed from stdin into a short markdown list.
Used by .github/workflows/pet-trends.yml — kept as a standalone script
rather than embedded in the workflow YAML to avoid indentation
fragility in YAML block scalars.
"""
import sys
import xml.etree.ElementTree as ET

def main():
    try:
        root = ET.fromstring(sys.stdin.read())
    except ET.ParseError:
        print("- (could not parse feed)")
        return
    items = root.findall(".//item")[:5]
    if not items:
        print("- (no results)")
        return
    for it in items:
        title = (it.findtext("title") or "").strip()
        link = (it.findtext("link") or "").strip()
        pubdate = (it.findtext("pubDate") or "").strip()
        print(f"- {title} ({pubdate}) — {link}")

if __name__ == "__main__":
    main()

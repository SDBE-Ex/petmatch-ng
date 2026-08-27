#!/usr/bin/env python3
"""Build a safe SQL INSERT for a content/ready/*.json draft.

Used by .github/workflows/publish-post.yml. Reads one draft JSON file
(title, body, link_url, link_label, image_url, and the optional
source_headline/source_url — whichever trend headline the routine
picked the topic from, for the admin Content tab's "why this was
suggested" column) and writes a SQL file that inserts it into
public.posts with published=false (submitted for admin review, not
yet live), using dollar-quoting (a random per-run tag) instead of
string-escaping so arbitrary article text — quotes, apostrophes,
whatever — can never break the statement or enable injection.
source_headline/source_url are optional: a draft written before the
routine's prompt is updated to emit them just inserts null for both,
same as any other missing field here.
"""
import json
import random
import string
import sys


def dollar_tag():
    return "pmtag" + "".join(random.choices(string.ascii_lowercase, k=8))


def sql_value(value, tag):
    if value is None:
        return "null"
    return f"${tag}${value}${tag}$"


def main():
    if len(sys.argv) != 3:
        print("usage: build_publish_sql.py <draft.json> <out.sql>", file=sys.stderr)
        sys.exit(1)

    draft_path, out_path = sys.argv[1], sys.argv[2]
    with open(draft_path, encoding="utf-8") as f:
        draft = json.load(f)

    title = draft.get("title")
    body = draft.get("body")
    link_url = draft.get("link_url")
    link_label = draft.get("link_label")
    image_url = draft.get("image_url")
    source_headline = draft.get("source_headline")
    source_url = draft.get("source_url")

    if not title or not body:
        print("draft is missing title or body", file=sys.stderr)
        sys.exit(1)

    title_sql = sql_value(title, dollar_tag())
    body_sql = sql_value(body, dollar_tag())
    link_url_sql = sql_value(link_url, dollar_tag())
    link_label_sql = sql_value(link_label, dollar_tag())
    image_url_sql = sql_value(image_url, dollar_tag())
    source_headline_sql = sql_value(source_headline, dollar_tag())
    source_url_sql = sql_value(source_url, dollar_tag())

    sql = f"""insert into public.posts (title, body, link_url, link_label, image_url, source_headline, source_url, published, author_email)
values ({title_sql}, {body_sql}, {link_url_sql}, {link_label_sql}, {image_url_sql}, {source_headline_sql}, {source_url_sql}, false, 'automation@petmatch.fit')
returning id, title;
"""

    with open(out_path, "w", encoding="utf-8") as f:
        f.write(sql)

    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()

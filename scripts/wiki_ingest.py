#!/usr/bin/env python3
"""Snapshot official MFL web pages into docs/wiki/ as markdown.

Usage: python scripts/wiki_ingest.py <url> [<url> ...]
Requires: pip install requests beautifulsoup4 markdownify
"""
import datetime
import pathlib
import re
import sys
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from markdownify import markdownify

WIKI = pathlib.Path(__file__).resolve().parent.parent / "docs" / "wiki"
SECTIONS = {"news.playmfl.com": "news", "guide.playmfl.com": "guide", "help.playmfl.com": "help"}


def out_path(url: str) -> pathlib.Path:
    p = urlparse(url)
    section = SECTIONS.get(p.netloc, p.netloc)
    path = p.path.strip("/")
    if section == "news":
        path = re.sub(r"^articles/", "", path)
    return WIKI / section / ((path or "index") + ".md")


def ingest(url: str) -> pathlib.Path:
    r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    title = (soup.title.string if soup.title else url).split("|")[0].strip()
    main = soup.find("article") or soup.find("main") or soup.body
    for tag in main.find_all(["script", "style", "nav", "button", "svg", "noscript", "footer"]):
        tag.decompose()
    for a in main.find_all("a", href=True):
        a["href"] = urljoin(url, a["href"])
    for img in main.find_all("img", src=True):
        img["src"] = urljoin(url, img["src"])
    md = markdownify(str(main), heading_style="ATX", bullets="-")
    md = re.sub(r"\n{3,}", "\n\n", md).strip()
    dest = out_path(url)
    dest.parent.mkdir(parents=True, exist_ok=True)
    today = datetime.date.today().isoformat()
    dest.write_text(
        f"---\ntitle: \"{title}\"\nsource: {url}\nfetched: {today}\nofficial: true\n---\n\n{md}\n"
    )
    return dest


if __name__ == "__main__":
    for u in sys.argv[1:]:
        try:
            d = ingest(u)
            print(f"ok   {d.relative_to(WIKI)}  ({d.stat().st_size} B)")
        except Exception as e:  # keep going; report at the end of the line
            print(f"FAIL {u}: {e}")

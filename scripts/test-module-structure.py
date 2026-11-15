#!/usr/bin/env python3
"""Check module pages against admin/standards/MODULE_PAGE_STANDARD.md,
and every public HTML page against the shared-shell rule (see check_shell).

Pages listed in PENDING still deviate and are reported as warnings only;
remove a page from PENDING once it has been restructured.
"""
from html.parser import HTMLParser
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
PAGES = {1: "prepare.html", **{n: f"module-{n}.html" for n in range(2, 10)}}
PENDING = {2, 3, 4, 5, 6, 7, 9}
STEP = re.compile(r"^\d+ · \S")


class Sections(HTMLParser):
    """Collect top-level <section> elements of <main>: classes, id, eyebrow, heading."""

    def __init__(self):
        super().__init__()
        self.in_main = False
        self.depth = 0
        self.items = []
        self.capture = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "main":
            self.in_main = True
        if not self.in_main:
            return
        if tag == "section":
            self.depth += 1
            if self.depth == 1:
                self.items.append({"id": a.get("id", ""), "cls": a.get("class", ""), "eyebrow": "", "heading": ""})
        elif self.depth == 1 and self.items:
            if tag == "p" and "eyebrow" in (a.get("class") or "") and not self.items[-1]["eyebrow"]:
                self.capture = "eyebrow"
            elif tag in ("h1", "h2") and not self.items[-1]["heading"]:
                self.capture = "heading"

    def handle_endtag(self, tag):
        if tag == "section" and self.in_main:
            self.depth -= 1
        if tag in ("p", "h1", "h2"):
            self.capture = None
        if tag == "main":
            self.in_main = False

    def handle_data(self, data):
        if self.capture and self.items:
            self.items[-1][self.capture] += data.strip()


def problems(path):
    parser = Sections()
    parser.feed(path.read_text(encoding="utf-8"))
    s = parser.items
    out = []
    if not s or "prepare-hero" not in s[0]["cls"] or not re.match(r"^(Module|โมดูล) \d", s[0]["eyebrow"]):
        out.append("hero: first section must be .prepare-hero with eyebrow 'Module N'")
        return out
    body = [x for x in s[1:] if "final-cta" not in x["cls"]]
    ids = [x["id"] for x in body]
    if not body or body[0]["id"] not in ("start", "prerequisites") or body[0]["eyebrow"] != "การเตรียมตัวก่อนเรียน":
        out.append("2nd section must be #start (eyebrow การเตรียมตัวก่อนเรียน)")
    if len(body) < 2 or body[1]["id"] != "outcomes":
        out.append("3rd section must be #outcomes")
    if len(body) < 3 or not STEP.match(body[2]["eyebrow"]):
        out.append("4th section must be step 1 (eyebrow 'N · …')")
    steps = [x for x in body if STEP.match(x["eyebrow"])]
    numbers = [int(x["eyebrow"].split(" ")[0]) for x in steps]
    if numbers != list(range(1, len(numbers) + 1)):
        out.append(f"step numbers must run 1..n, got {numbers}")
    for x in body:
        if not x["eyebrow"]:
            out.append(f"section #{x['id'] or '?'} has no eyebrow")
    finish = next((i for i in ("finish", "homework") if i in ids), None)  # M1 keeps #homework
    if finish is None:
        out.append("missing #finish")
    elif ids[-1] != finish:
        out.append(f"sections after #finish: {ids[ids.index(finish) + 1:]}")
    if path.name != "prepare.html" and "final-cta" not in s[-1]["cls"]:
        out.append("last section must be .final-cta")
    return out


# Shared interface rule for every public HTML page (keeps new pages on one shell):
#   1. loads assets/site-shell.js (header, nav, light/dark theme);
#   2. <body> carries exactly one mode class: learn (lessons, + learn.css),
#      console (app/admin pages, + console.css) or landing (entry/marketing pages);
#   3. no inline <style> blocks: page styles live in the shared CSS files.
MODES = {"learn": "learn.css", "console": "console.css", "landing": None}
SHELL_EXEMPT = {"404.html": "static error page served at any depth, no header"}
BODY = re.compile(r"<body\b[^>]*>", re.I)
BODY_CLASS = re.compile(r"""class\s*=\s*["']([^"']*)["']""", re.I)


def shell_problems(path):
    text = path.read_text(encoding="utf-8")
    out = []
    if "site-shell.js" not in text:
        out.append("does not load assets/site-shell.js")
    body = BODY.search(text)
    match = BODY_CLASS.search(body.group(0)) if body else None
    modes = [c for c in (match.group(1).split() if match else []) if c in MODES]
    if len(modes) != 1:
        out.append(f"<body> needs exactly one mode class of {sorted(MODES)}, found {modes or 'none'}")
    elif MODES[modes[0]] and MODES[modes[0]] not in text:
        out.append(f"body.{modes[0]} page must load assets/{MODES[modes[0]]}")
    if re.search(r"<style\b", text, re.I):
        out.append("inline <style> block (move it to a shared CSS file)")
    return out


def check_shell():
    failed = False
    pages = sorted(p for p in ROOT.rglob("*.html") if ".git" not in p.parts and "downloads" not in p.parts)
    for page in pages:
        name = page.relative_to(ROOT).as_posix()
        if name in SHELL_EXEMPT:
            continue
        found = shell_problems(page)
        if found:
            failed = True
            print(f"FAIL shell {name}: " + "; ".join(found))
    print(f"Shared-shell checks {'failed' if failed else 'passed'} ({len(pages) - len(SHELL_EXEMPT)} pages; exempt: {', '.join(SHELL_EXEMPT)}).")
    return failed


def main():
    failed = check_shell()
    for number, name in PAGES.items():
        found = problems(ROOT / name)
        if not found:
            print(f"PASS M{number} {name}")
            continue
        label = "PENDING" if number in PENDING else "FAIL"
        failed |= number not in PENDING
        print(f"{label} M{number} {name}: " + "; ".join(found[:4]) + (" …" if len(found) > 4 else ""))
    if failed:
        sys.exit(1)
    print("Module structure checks passed (pending pages listed as warnings).")


if __name__ == "__main__":
    main()

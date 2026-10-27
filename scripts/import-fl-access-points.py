#!/usr/bin/env python3
"""Import Florida Access Points from a CPALMS standards export.

WHAT THESE ARE
--------------
Access Points are Florida's alternate academic standards for students with
significant cognitive disabilities. They are real, official standards -- not a
simplified rewrite someone made up -- which is why they go through an importer
like every other catalogue here, and why nothing in them is written by VIC.

They are assigned by an IEP team, never inferred from low scores. A child who
reads poorly is not an Access Points child; that confusion is how a struggling
reader gets quietly moved onto an alternate diploma track.

WHY A SEPARATE FILE
-------------------
These deliberately do NOT go into data/lesson-standards.json. Existing queries
filter the catalogue by state + subject + grade (see pages/api/student/
practice.js), so an Access Point sitting in that file would be served to any
child whose grade matched -- silently, and the screen would look fine. A
separate file cannot be reached by accident.

Usage: python3 scripts/import-fl-access-points.py <math.doc> <ela.doc>
The inputs are CPALMS "Standards and Access Points" exports: HTML saved with a
.doc extension.
"""
import re, sys, json, html, collections
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "access-points.json"
CPALMS = "https://www.cpalms.org/Standards/Access_Points.aspx"

AP_CODE = re.compile(r"^(MA|ELA)\.(K12|K|\d{1,2})\.([A-Z]+)\.(\d+)\.AP\.([a-z0-9]+)$")
BENCH = re.compile(r"^(MA|ELA)\.(K12|K|\d{1,2})\.([A-Z]+)\.(\d+)\.(\d+)$")

def flatten(path):
    raw = Path(path).read_text(encoding="utf-8", errors="replace")
    text = re.sub(r"<[^>]+>", "|", raw)
    text = html.unescape(text)
    return [p.strip() for p in re.sub(r"\|+", "|", text).split("|") if p.strip()]

# --- support policy, the same rule used for the general catalogue -------------
# See scripts/tag-standard-supports.py. Support everything except the thing being
# measured; the gate only ever closes on assessed content, never on directions.
def policy(subject, strand, grade, text):
    if subject == "math":
        return "free", "free", False
    g = 0 if grade == "K" else int(grade)
    review = False
    # The AP text itself sometimes settles the question -- "read or heard",
    # "read aloud" -- and where the document speaks, a human should look.
    if re.search(r"\bread aloud\b|\bheard\b|\borally\b|\bread or heard\b", text, re.I):
        review = True
    if strand == "F":          # Foundations: print concepts, phonics, decoding, fluency.
        return "none", "scaffold_only", review
    if strand == "C":          # Communication: writing, handwriting, presenting.
        return "free", "scaffold_only", review
    if strand == "R":          # Reading. The passage is the thing being measured.
        return ("free", "scaffold_only", True) if g <= 1 else ("stem_only", "scaffold_only", review)
    if strand == "V":          # Vocabulary.
        return ("free", "scaffold_only", True) if g <= 1 else ("stem_only", "scaffold_only", True)
    return "stem_only", "scaffold_only", True

def parse(path, label):
    parts = flatten(path)
    rows, bench = [], None
    for i, part in enumerate(parts):
        if BENCH.match(part):
            bench = part
            continue
        m = AP_CODE.match(part)
        if not m:
            continue
        subject_code, grade, strand, _cluster, _n = m.groups()
        # MA.K12.MTR.* are the mathematical thinking standards: they span every grade
        # and are not a teachable ladder rung, so they are left out as in the general
        # catalogue.
        if grade == "K12":
            continue
        text = parts[i + 1] if i + 1 < len(parts) else ""
        if not text or AP_CODE.match(text) or BENCH.match(text):
            continue
        subject = "math" if subject_code == "MA" else "reading"
        audio, translate, review = policy(subject, strand, grade, text)
        row = {
            "id": f"FL:{part}",
            "state": "FL",
            "track": "access",
            "subject": subject,
            "grade": grade,
            "code": part,
            "text": text,
            # Which general benchmark this Access Point is the alternate route to.
            # A teacher looking at a report needs to see the grade-level skill it maps
            # to, not only the AP.
            "related_to": f"FL:{bench}" if bench else None,
            "source": CPALMS,
            "document": label,
            "version": "Florida Access Points, CPALMS export; source checked 2026-10-27",
            "audio": audio,
            "translate": translate,
        }
        if review:
            row["review"] = True
        rows.append(row)
    return rows

def main():
    if len(sys.argv) < 3:
        sys.exit("usage: import-fl-access-points.py <math.doc> <ela.doc>")
    rows = []
    rows += parse(sys.argv[1], "Mathematics (B.E.S.T.) Standards and Access Points")
    rows += parse(sys.argv[2], "English Language Arts (B.E.S.T.) Standards and Access Points")

    seen, uniq = set(), []
    for r in rows:
        if r["id"] in seen:
            continue
        seen.add(r["id"])
        uniq.append(r)
    uniq.sort(key=lambda r: (r["subject"], 0 if r["grade"] == "K" else int(r["grade"]), r["code"]))
    OUT.write_text(json.dumps(uniq, indent=2, ensure_ascii=False) + "\n")

    print(f"wrote {len(uniq)} access points to {OUT.relative_to(ROOT)}\n")
    by = collections.Counter((r["subject"], r["grade"]) for r in uniq)
    print("by subject and grade:")
    for subject in ("math", "reading"):
        grades = sorted(((g, n) for (s, g), n in by.items() if s == subject),
                        key=lambda x: 0 if x[0] == "K" else int(x[0]))
        print(f"  {subject:8}", "  ".join(f"{g}:{n}" for g, n in grades))
    print("\nsupport policy:")
    for k, n in sorted(collections.Counter((r["subject"], r["audio"]) for r in uniq).items()):
        print(f"  {k[0]:8} {k[1]:10} {n}")
    print(f"\nflagged for teacher review: {sum(1 for r in uniq if r.get('review'))}")
    missing = [r['id'] for r in uniq if not r['related_to']]
    print(f"access points with no related benchmark: {len(missing)}")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Import Florida science and social studies standards into the lesson catalogue.

Both subjects are merged into data/lesson-standards.json alongside the existing
math and reading entries. Nothing here is written by VIC or by an AI: every row
is lifted verbatim from an official document.

SOURCES
-------
Social studies: "Florida's State Academic Standards -- Social Studies 2025",
rule 6A-1.09401, F.A.C. (https://www.fldoe.org/file/20885/7-3.pdf). Parsed from
the PDF. Benchmark Clarifications are excluded, matching how the B.E.S.T. math
and ELA imports treat them -- the benchmark wording is the standard.

Science: NGSSS science benchmarks, exported from CPALMS as a "Benchmark Results"
table (www.cpalms.org). Parsed from the .docx export.

Both are filtered to K-8, the catalogue's range. The 9-12 banded codes
(SS.912.*, SC.912.*) are dropped.

Usage: python3 scripts/import-fl-science-socialstudies.py <fl-ss.pdf> <fl-sci-export.docx>
"""
import json, re, sys, zipfile, subprocess, collections
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOGUE = ROOT / "data" / "lesson-standards.json"
GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8"]

SS_SOURCE = "https://www.fldoe.org/file/20885/7-3.pdf"
SS_VERSION = "Florida's State Academic Standards -- Social Studies 2025, rule 6A-1.09401 F.A.C.; source checked 2026-11-05"
SCI_SOURCE = "https://www.cpalms.org/"
SCI_VERSION = "Florida NGSSS science benchmarks, CPALMS export; source checked 2026-11-05"

def clean(s):
    s = s.replace("\x02", "-").replace("ﬁ", "fi").replace("ﬂ", "fl").replace("­", "")
    return re.sub(r"\s+", " ", s).strip()

# --- social studies: PDF ------------------------------------------------------
# A benchmark is a 5-part code (SS.K.A.1.1). A 4-part code (SS.K.A.1) is the
# standard heading above it and is not itself a benchmark.
BENCH = re.compile(r"(?m)^(SS\.(K|[1-8]|68|912)\.([A-Z]{1,2})\.(\d+)\.(\d+))\s*")
STOP = re.compile(r"Benchmark Clarifications:|Clarification \d|^\s*SS\.|FLORIDA.S STATE ACADEMIC STANDARDS", re.M)

def social_studies(path):
    rows = {}
    pages = subprocess.check_output(["pdftotext", "-raw", str(path), "-"]).decode().split("\f")
    for pn, text in enumerate(pages):
        for m in BENCH.finditer(text):
            code, grade = m.group(1), m.group(2)
            if grade not in GRADES and grade != "68":
                continue  # 9-12 band is outside the catalogue
            tail = text[m.end():]
            tail = STOP.split(tail)[0]
            tail = re.sub(r"\n\d+\n", " ", tail)
            ends = list(re.finditer(r"[.!?](?:\s|$)", tail))
            if ends:
                tail = tail[:ends[-1].end()]
            tail = clean(tail)
            if len(tail) < 12:
                continue
            # SS.68.* is the middle-school African American History strand: it is
            # one set of benchmarks taught across 6, 7 and 8, so it is filed under
            # each of those grades rather than invented into a "68" grade the
            # planner has no dropdown for.
            for g in (["6", "7", "8"] if grade == "68" else [grade]):
                key = (code, g)
                # One row per grade needs its own id: the planner resolves a saved
                # standard with catalogue.find(r => r.id === id) and then checks the
                # row's grade, so three rows sharing "FL:SS.68.AA.1.1" would always
                # resolve to grade 6 and reject a grade 7 or 8 teacher. The teacher
                # still sees the official code; only the internal id carries @grade.
                row_id = "FL:" + code + ("@" + g if grade == "68" else "")
                if key not in rows or len(tail) > len(rows[key]["text"]):
                    rows[key] = {"id": row_id, "state": "FL", "subject": "socialstudies", "grade": g,
                                 "code": code, "text": tail, "source": SS_SOURCE, "page": pn + 1,
                                 "version": SS_VERSION, "audio": "free", "translate": "free"}
    return list(rows.values())

# --- science: CPALMS .docx export --------------------------------------------
def cells(row_xml):
    return [clean("".join(re.findall(r"<w:t[^>]*>(.*?)</w:t>", c, re.S)))
            for c in re.findall(r"<w:tc>(.*?)</w:tc>", row_xml, re.S)]

def science(path):
    xml = zipfile.ZipFile(path).read("word/document.xml").decode("utf8")
    rows, seen = [], set()
    for row_xml in re.findall(r"<w:tr>(.*?)</w:tr>", xml, re.S):
        c = cells(row_xml)
        if len(c) != 7 or c[0] == "Benchmark#":
            continue
        code, text, grade = c[0], c[1], c[4]
        if grade not in GRADES or not re.fullmatch(r"SC\.(K|[1-8])\.[A-Z]\.\d+\.\d+", code):
            continue
        if len(text) < 12 or code in seen:
            continue
        seen.add(code)
        rows.append({"id": "FL:" + code, "state": "FL", "subject": "science", "grade": grade,
                     "code": code, "text": text, "source": SCI_SOURCE, "page": None,
                     "version": SCI_VERSION, "audio": "free", "translate": "free",
                     "strand": c[5] or None})
    return rows

def main():
    ss_pdf, sci_docx = sys.argv[1], sys.argv[2]
    catalogue = json.loads(CATALOGUE.read_text())
    kept = [r for r in catalogue if not (r["state"] == "FL" and r["subject"] in ("science", "socialstudies"))]
    added = social_studies(ss_pdf) + science(sci_docx)
    merged = kept + added
    merged.sort(key=lambda r: (r["state"], r["subject"], 0 if r["grade"] == "K" else int(r["grade"]), r["code"]))
    CATALOGUE.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n")
    for subject in ("science", "socialstudies"):
        c = collections.Counter(r["grade"] for r in added if r["subject"] == subject)
        print(subject, {g: c.get(g, 0) for g in GRADES}, "total", sum(c.values()))
    print("Catalogue total", len(merged))

if __name__ == "__main__":
    main()

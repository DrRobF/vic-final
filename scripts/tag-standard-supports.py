#!/usr/bin/env python3
"""Tag every standard with what support a child may be given ON THE ASSESSED CONTENT.

WHY THIS EXISTS
---------------
Reading a math word problem aloud removes a barrier that is not the point: the
standard is about ratios, not decoding. Reading a comprehension passage aloud
removes the point itself. Same button, opposite meaning. The difference is not
the child and not the lesson -- it is what the standard measures. So the decision
belongs to the standard, decided once, rather than to VIC in the moment.

IMPORTANT: `audio` and `translate` are AskVic's accommodation policy. They are NOT
from the official standards documents. Every other field in the catalogue is
sourced (see scripts/import-ccss-*.py and the `source`/`page`/`version` fields) and
this script never touches those.

WHAT THE VALUES MEAN
--------------------
These govern ASSESSED CONTENT ONLY -- the passage, the item, the thing the child
is being judged on. Directions, question stems, answer choices, VIC's own
explanation and encouragement are scaffolding and are ALWAYS speakable and
always translatable, under every value below. That distinction is the whole
design: a struggling reader who cannot decode the instructions fails for a
reason that has nothing to do with the standard.

audio:
  free      - read anything aloud. Reading is not the construct (all math, writing).
  stem_only - read directions, question and choices; NOT the passage under analysis.
              (reading comprehension, grades 2+)
  none      - read nothing in the assessed task. The task IS reading the words.
              (phonics, decoding, fluency, print concepts)
  required  - the task must be HEARD; there may be no text at all.
              (speaking and listening, phonological awareness)

translate:
  free           - translate the assessed content. The construct survives any
                   language (all math).
  scaffold_only  - translate directions and explanation, never the English text
                   under study. Translating it measures nothing. (all ELA)

review: true marks a standard where the rule above is a judgement call rather
than a mechanical read of the strand. Those are the ones a teacher should audit --
a short list, not 1,724 rows.
"""
import json, re, sys, collections
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOGUE = ROOT / "data" / "lesson-standards.json"

def grade_num(g):
    return 0 if str(g).upper() == "K" else int(g)

def ccss(code, grade):
    """CCSS ELA strands: RF, RL, RI, L, SL, W."""
    strand = code.split(".")[0].upper()
    g = grade_num(grade)
    if strand == "SL":
        return "required", False
    if strand == "W":
        return "free", False
    if strand == "RF":
        # RF.<grade>.2 is phonological awareness: an oral task, no text on the page.
        # RF.1 print concepts, RF.3 phonics, RF.4 fluency are all reading the words.
        parts = code.split(".")
        if len(parts) >= 3 and parts[2] == "2":
            return "required", False
        return "none", False
    if strand in ("RL", "RI"):
        # In CCSS, K-1 literature and informational standards are explicitly assessed
        # on texts READ ALOUD to the child ("with prompting and support"). The child
        # decoding it themselves is not the construct until grade 2.
        return ("free", True) if g <= 1 else ("stem_only", False)
    if strand == "L":
        parts = code.split(".")
        sub = parts[2] if len(parts) >= 3 else ""
        # L.1 grammar / L.2 conventions / L.3 usage are demonstrated in writing or
        # speaking -- no passage to protect.
        if sub in ("1", "2", "3"):
            return "free", False
        # L.4 meaning from context, L.5 word relationships, L.6 acquired vocabulary.
        # From grade 2 these lean on reading the context; below that they are oral.
        return ("free", True) if g <= 1 else ("stem_only", True)
    return "stem_only", True

def best(code, grade):
    """Florida B.E.S.T. ELA strands: F foundations, R reading, C communication, V vocabulary."""
    parts = code.split(".")
    strand = parts[2].upper() if len(parts) > 2 else ""
    g = grade_num(grade)
    if strand == "F":
        # F.1.2 is phonological awareness -- heard, not read.
        if len(parts) >= 5 and parts[3] == "1" and parts[4] == "2":
            return "required", False
        return "none", False
    if strand == "C":
        # Communication: handwriting, writing, presenting. Reading is not the construct.
        return "free", False
    if strand == "R":
        return ("free", True) if g <= 1 else ("stem_only", False)
    if strand == "V":
        return ("free", True) if g <= 1 else ("stem_only", True)
    return "stem_only", True

def pacore(code, grade):
    """PA Core: CC.1.1 foundational, 1.2 informational, 1.3 literature, 1.4 writing, 1.5 speaking."""
    parts = code.split(".")
    strand = ".".join(parts[:3]) if len(parts) >= 3 else code
    g = grade_num(grade)
    if strand == "CC.1.1":
        # Foundational skills. PA folds phonological awareness in here as the .B/.C
        # letters at K-1; those are oral tasks.
        letter = parts[4].upper() if len(parts) >= 5 else ""
        if g <= 1 and letter in ("B", "C"):
            return "required", True
        return "none", False
    if strand == "CC.1.5":
        return "required", False
    if strand == "CC.1.4":
        return "free", False
    if strand in ("CC.1.2", "CC.1.3"):
        return ("free", True) if g <= 1 else ("stem_only", False)
    return "stem_only", True

def policy(std):
    if std["subject"] == "math":
        # Reading is never the construct in a math standard. Read it, translate it.
        return "free", "free", False
    state = std["state"]
    code, grade = std["code"], std["grade"]
    if state == "CCSS":
        audio, review = ccss(code, grade)
    elif state == "FL":
        audio, review = best(code, grade)
    elif state == "PA":
        audio, review = pacore(code, grade)
    else:
        audio, review = "stem_only", True
    # English language arts cannot be assessed in another language. Scaffolding can.
    return audio, "scaffold_only", review

def main():
    stds = json.loads(CATALOGUE.read_text())
    counts = collections.Counter()
    review = []
    for s in stds:
        audio, translate, needs_review = policy(s)
        s["audio"] = audio
        s["translate"] = translate
        if needs_review:
            s["review"] = True
        else:
            s.pop("review", None)
        counts[(s["subject"], audio, translate)] += 1
        if needs_review:
            review.append(s)
    CATALOGUE.write_text(json.dumps(stds, indent=2, ensure_ascii=False) + "\n")

    print(f"tagged {len(stds)} standards\n")
    print(f"{'subject':9} {'audio':10} {'translate':14} count")
    for (subject, audio, translate), n in sorted(counts.items()):
        print(f"{subject:9} {audio:10} {translate:14} {n}")
    print(f"\nflagged for teacher review: {len(review)}")
    by = collections.Counter((s["state"], s["code"].split('.')[0] if s["state"] == "CCSS" else s["state"]) for s in review)
    for k, n in by.most_common():
        print(f"  {k[0]:5} {n}")

if __name__ == "__main__":
    main()

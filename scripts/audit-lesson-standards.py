"""Parse the official PDFs (text extracted with pdftotext -raw) into rows.
Dry-run helper: prints counts and writes parsed.json. No AI-authored text."""
import re, json, sys, pathlib
src = pathlib.Path(sys.argv[1])

def clean(s):
    s = s.replace('\x02', '-').replace('ﬁ', 'fi').replace('ﬂ', 'fl').replace('­', '')
    return re.sub(r'\s+', ' ', s).strip()

STOP = re.compile(r'^(Benchmark Clarification|Clarification|Example|Examples|Related|Algebra Example|Instructional|Remarks|Note:|Attributes|Cognitive|Supporting|Cross|Mathematical|Item|Assessment|Students|Taxonomy|Vocabulary|Benchmarks? Cluster|Standard\s+\d|Strand|Category|Domain|Grade\s+\d|Florida|B\.E\.S\.T|English Language Arts|Mathematics|Page\s+\d|\d+$)', re.I)

rows = {}
def add(state, subject, grade, code, text, tag):
    text = clean(text)
    if len(text) < 12:
        return
    key = state + ':' + code
    prev = rows.get(key)
    # keep the longest clean version when a code appears in several places (maps, detail pages)
    if prev is None or len(text) > len(prev['text']):
        rows[key] = {'id': key, 'state': state, 'subject': subject, 'grade': grade, 'code': code, 'text': text, 'tag': tag}

def fl(txt, prefix, subject, pat):
    lines = txt.split('\n')
    code_re = re.compile(r'^(' + pat + r')\s*:?\s*(.*)$')
    for i, ln in enumerate(lines):
        m = code_re.match(ln.strip())
        if not m:
            continue
        code, first = m.group(1), m.group(2)
        grade = code.split('.')[1]
        buf = [first] if first else []
        for nxt in lines[i + 1:i + 12]:
            s = nxt.strip()
            if not s or STOP.match(s) or re.match(r'^(MA|ELA)\.', s):
                break
            buf.append(s)
        add('FL', subject, grade, code, ' '.join(buf), 'fl')

fl(open(src / 'fl-math.txt').read(), 'MA', 'math', r'MA\.[K1-8]\.[A-Z]+\.\d+\.\d+')
fl(open(src / 'fl-ela.txt').read(), 'ELA', 'reading', r'ELA\.[K1-8]\.[FRCV]\.\d+\.\d+')

# Pennsylvania: code line, then description lines until an eligible-content code, another CC code, or a bare label
EC = re.compile(r'^([A-Z]\d{1,2}\.|[A-Z]\d\.\d|\(|[A-Z]{1,3}\d?\.[A-Z0-9-]+\.\d)')
def pa(txt, subject, code_pat):
    lines = [l.strip() for l in txt.split('\n')]
    cre = re.compile(r'^(' + code_pat + r')\s*(.*)$')
    for i, ln in enumerate(lines):
        m = cre.match(ln)
        if not m:
            continue
        code = m.group(1)
        parts = code.split('.')
        grade = parts[3]
        buf = [m.group(2)] if m.group(2) else []
        for nxt in lines[i + 1:i + 14]:
            if not nxt or re.match(r'^CC\.', nxt) or EC.match(nxt) or re.match(r'^\d+$', nxt):
                break
            buf.append(nxt)
        add('PA', subject, grade, code, ' '.join(buf), 'pa')

pa(open(src / 'pa-math.txt').read(), 'math', r'CC\.2\.[1-4]\.[K1-8]\.[A-Z]\.\d+')
pa(open(src / 'pa-ela-612.txt').read(), 'reading', r'CC\.1\.[2-5]\.[678]\.[A-Z]')

json.dump(list(rows.values()), open(src / 'parsed.json', 'w'), indent=1, ensure_ascii=False)
import collections
c = collections.Counter((r['state'], r['subject'], r['grade']) for r in rows.values())
for k in sorted(c): print(k, c[k])

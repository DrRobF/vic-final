import re, json, collections, pdfplumber
STRANDS=[('Reading Standards for Literature','RL'),('Reading Standards for Informational Text','RI'),('Reading Standards: Foundational Skills','RF'),('Writing Standards','W'),('Speaking and Listening Standards','SL'),('Language Standards','L')]
rows={}
import subprocess
RAW=subprocess.check_output(['pdftotext','-raw','src/ccss-ela.pdf','-'],stderr=subprocess.DEVNULL).decode().split('\f')
def strand_of(text):
    head='\n'.join(text.split('\n')[:14])
    if 'Literacy in History' in head or 'Science and Technical' in head: return None
    for title,code in STRANDS:
        if title in head and 'Anchor' not in head: return code
    return None
HEADING_NEXT=re.compile(r'^\d+\.\s')
with pdfplumber.open('src/ccss-ela.pdf') as pdf:
    for pn,page in enumerate(pdf.pages):
        text=RAW[pn]
        code=strand_of(text)
        if not code: continue
        words=page.extract_words(keep_blank_chars=False,use_text_flow=False)
        heads=[]  # (x0, grade)
        for i,w in enumerate(words):
            if w['text']=='Kindergartners:': heads.append((w['x0'],'K'))
            elif w['text']=='Grade' and i+2<len(words) and re.fullmatch(r'[1-8]',words[i+1]['text']) and words[i+2]['text']=='students:' and abs(words[i+2]['top']-w['top'])<3:
                heads.append((w['x0'],words[i+1]['text']))
            elif w['text']=='Grades' and i+2<len(words) and words[i+2]['text']=='students:':
                heads.append((w['x0'],None))
        heads.sort()
        if len(heads)<2: continue
        top=min(w['top'] for w in words if w['text'] in ('Kindergartners:','Grade','Grades') and abs(w['x0']-heads[0][0])<2 or False) if False else None
        hdr_top=max(w['bottom'] for w in words if w['text'] in('students:','Kindergartners:'))
        nums=sorted({round(w['x0']) for w in words if re.fullmatch(r'\d{1,2}\.',w['text'])})
        starts=[]
        if len(nums)==len(heads): starts=list(nums)
        for hx,_g in ([] if starts else heads):
            cand=[n for n in nums if abs(n-(hx-60))<=28]
            starts.append(min(cand,key=lambda n:abs(n-(hx-60))) if cand else hx-60)
        starts.append(page.width+8)
        for ci,(x0,grade) in enumerate(heads):
            if grade is None: continue
            col=page.crop((max(starts[ci]-4,0),hdr_top,min(starts[ci+1]-6,page.width),page.height-30))
            lines=[l.strip() for l in (col.extract_text() or '').split('\n') if l.strip()]
            items=[];cur=None
            for k,l in enumerate(lines):
                m=re.match(r'^(\d+)\.\s+(.*)$',l)
                nxt=lines[k+1] if k+1<len(lines) else ''
                if m and not (cur and re.match(r'^[a-z]\.',l)):
                    cur=[int(m.group(1)),[m.group(2)]]; items.append(cur)
                elif cur is not None:
                    # drop section sub-headings that sit between items
                    if HEADING_NEXT.match(nxt) and not re.search(r'[.;:)”]$',l) and l[0].isupper() and len(l)<60:
                        continue
                    if re.fullmatch(r'\d+',l) or l.startswith('Common Core') : continue
                    cur[1].append(l)
            for n,parts in items:
                txt=re.sub(r'\s+',' ',' '.join(parts)).strip()
                if re.match(r'^\(Begins',txt) or re.match(r'^\(Not applicable',txt): continue
                key=f'{code}.{grade}.{n}'
                if key not in rows or len(txt)>len(rows[key]['text']):
                    rows[key]={'code':key,'grade':grade,'strand':code,'text':txt,'page':pn+1}
json.dump(list(rows.values()),open('src/ccss-ela-parsed.json','w'),indent=1,ensure_ascii=False)
c=collections.Counter((r['strand'],r['grade']) for r in rows.values())
for s in ['RL','RI','RF','W','SL','L']:
    print(s,{g:c[(s,g)] for g in ['K','1','2','3','4','5','6','7','8'] if c[(s,g)]})
print(len(rows))

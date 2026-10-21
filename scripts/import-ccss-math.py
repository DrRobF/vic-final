import re, json, subprocess, sys, collections
src='src/ccss-math.pdf'
pages=subprocess.check_output(['pdftotext','-raw',src,'-'],stderr=subprocess.DEVNULL).decode().split('\f')
code_re=re.compile(r'^(?:\d+\.\s*)?((?:K|[1-8])\.[A-Z]{1,3}\.[A-Z]\.\d+)\s*(.*)$')
stop_re=re.compile(r'^(?:[A-Z]\.\s+[A-Z]|Grade\s+(?:K|\d+)\b|Kindergarten\b|Mathematics\s*\||Standards for Mathematical|Domain|Cluster|(?:K|[1-8])\.[A-Z]{1,3}\s*$|[A-Z][A-Za-z ,&-]+\s+(?:K|[1-8])\.[A-Z]{1,3}$|\d+$|Note:|Common Core|Number and Quantity)')
rows={}
for pn,t in enumerate(pages):
    lines=[l.strip() for l in t.split('\n')]
    i=0
    while i<len(lines):
        m=code_re.match(lines[i])
        if not m or not re.match(r'^\d+\.\s',lines[i]) and not re.match(r'^K\.',lines[i]) and False:
            i+=1; continue
        code=m.group(1); buf=[m.group(2)] if m.group(2) else []
        j=i+1
        while j<len(lines):
            s=lines[j]
            if not s: j+=1; continue
            if code_re.match(s) or stop_re.match(s): break
            buf.append(s); j+=1
        txt=re.sub(r'\s+',' ',' '.join(buf)).strip()
        # joined sub-parts a./b. stay in the text, as in the official wording
        g=code.split('.')[0]
        if len(txt)>=12:
            if code not in rows or len(txt)>len(rows[code]['text']):
                rows[code]={'code':code,'grade':g,'text':txt,'page':pn+1}
        i=j
json.dump(list(rows.values()),open('src/ccss-math-parsed.json','w'),indent=1,ensure_ascii=False)
c=collections.Counter(r['grade'] for r in rows.values())
print(sorted(c.items(), key=lambda x:(x[0]!='K',x[0])), len(rows))

"""Rebuild standards catalogue from official downloaded PDFs; no AI-authored standards."""
import json,re,pathlib,sys,subprocess
import pdfplumber
root=pathlib.Path(__file__).resolve().parents[1]
src=pathlib.Path(sys.argv[1]);rows={}
def clean(s):
 s=s.replace('\x02','-').replace('\ufb01','fi').replace('\ufb02','fl').replace('\u00ad','')
 return re.sub(r'\s+',' ',s).strip()
def add(state,subject,grade,code,text,source,page,version):
 text=clean(text)
 if len(text)<12: raise ValueError((code,text))
 rows[state+':'+code]={'id':state+':'+code,'state':state,'subject':subject,'grade':grade,'code':code,'text':text,'source':source,'page':page,'version':version}
flmath='https://cpalmsmediaprod.blob.core.windows.net/uploads/docs/standards/best/ma/mathbeststandardsfinal.pdf'
flela='https://www.fldoe.org/file/7539/elabeststandardsfinal.pdf'
for pn,txt in enumerate(subprocess.check_output(['pdftotext','-raw',str(src/'fl-math.pdf'),'-']).decode().split('\f')):
 matches=list(re.finditer(r'(?m)^\s*(MA\.([K1-8])\.[A-Z]+\.\d+\.\d+)\s*\n',txt))
 for m in matches:
  tail=txt[m.end():]
  tail=re.split(r'Benchmark Clarifications:|Example:|Examples:|(?m:^\s*MA\.)',tail)[0]
  ends=list(re.finditer(r'[.!?](?:\s|$)',tail))
  if ends:tail=tail[:ends[-1].end()]
  add('FL','math',m[2],m[1],tail,flmath,pn+1,'B.E.S.T. source checked 2026-10-04')
with pdfplumber.open(src/'fl-ela.pdf') as d:
 for pn,p in enumerate(d.pages):
  if pn<25:continue
  txt=p.extract_text(layout=False) or ''
  matches=list(re.finditer(r'(?m)^\s*(ELA\.([K1-8])\.[FRCV]\.\d+\.\d+):\s*',txt))
  for m in matches:
   tail=txt[m.end():]
   tail=re.split(r'Benchmark Clarifications:|(?m:^\s*ELA\.)',tail)[0]
   ends=list(re.finditer(r'[.!?](?:\s|$)',tail))
   if ends:tail=tail[:ends[-1].end()]
   add('FL','reading',m[2],m[1],tail,flela,pn+1,'B.E.S.T. source checked 2026-10-04')
files=[('pa-math','math','https://files5.pdesas.org/197225152154114096041066124044193103201008094248/Download.ashx?hash=2.2'),('pa-ela-k5','reading','https://files5.pdesas.org/159088233196248070042222106141097062104159057223/Download.ashx?hash=2.2'),('pa-ela-612','reading','https://files5.pdesas.org/024110026141195116230120006196159028126173195033/Download.ashx?hash=2.2')]
for name,subject,url in files:
 with pdfplumber.open(src/(name+'.pdf')) as d:
  for pn,p in enumerate(d.pages):
   for table in p.extract_tables():
    for row in table:
     for cell in row:
      if not cell:continue
      matches=list(re.finditer(r'CC\.(?:1\.[1-5]\.([K1-8])\.[A-Z]|2\.[1-4]\.([K1-8])\.[A-Z]\.\d+)',cell))
      for i,m in enumerate(matches):
       tail=cell[m.end():matches[i+1].start() if i+1<len(matches) else len(cell)]
       tail=re.split(r'\b(?:E0[3-8]\.|M0[3-8]\.)',tail)[0]
       add('PA',subject,m[1] or m[2],m[0],tail,url,pn+1,'PA Core March 2014; source checked 2026-10-04')
items=sorted(rows.values(),key=lambda r:(r['state'],r['subject'],0 if r['grade']=='K' else int(r['grade']),r['code']))
(root/'data/lesson-standards.json').write_text(json.dumps(items,ensure_ascii=False,indent=2)+'\n')
for st in ['FL','PA']:
 for sub in ['math','reading']:
  print(st,sub,{g:sum(r['state']==st and r['subject']==sub and r['grade']==g for r in items) for g in ['K']+list('12345678')})
print('Total',len(items))

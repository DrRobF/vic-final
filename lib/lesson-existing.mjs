const clean=value=>String(value||'').trim()
export function readExistingLesson(source,catalogue=[],defaultSections=[]){
 const text=clean(source)
 const codes=[...new Set(text.match(/\b(?:ELA|MA)\.[K1-8]\.[A-Z]+\.\d+(?:\.\d+)*\b|\bCC\.\d+\.(?:\d+\.)?[K1-8]\.[A-Z](?:\.\d+)*\b/g)||[])].slice(0,3)
 const rows=codes.map(code=>catalogue.find(s=>s.code===code)).filter(Boolean)
 const verified=rows.length>0&&rows.length===codes.length&&rows.every(r=>r.state===rows[0].state&&r.grade===rows[0].grade&&r.subject===rows[0].subject)
 const gradeMatch=text.match(/\bGrade\s*[:\-]?\s*(K|[1-9]\d?)\b/i)||text.match(/\b(K|[1-8])(?:st|nd|rd|th)?[ -]grade\b/i)
 const grade=rows[0]?.grade||gradeMatch?.[1]?.toUpperCase()||( /\bkindergarten\b/i.test(text)?'K':'Same as original')
 const namedSubject=text.match(/\bSubject\s*:\s*([^\n]{1,100})/i)?.[1]?.trim()
 const subject=rows[0]?.subject||(/\b(?:ELA|English language arts|Reading\s*\/\s*ELA|literacy)\b/i.test(text)?'reading':/\b(?:math|mathematics)\b/i.test(text)?'math':namedSubject||'Same as original')
 const state=rows[0]?.state||(/\b(?:Florida|FL\s*[·|])\b/i.test(text)||codes.some(c=>/^(ELA|MA)\./.test(c))?'FL':/\bPennsylvania\b/i.test(text)||codes.some(c=>c.startsWith('CC.'))?'PA':'Original curriculum')
 const time=text.match(/(?:duration|lesson length|minutes per session|time allotted|total time)\s*[:\-]?\s*(\d{2,3})/i)||text.match(/\b(\d{2,3})\s*(?:minutes?|mins?)\s*(?:each|per session|lesson)\b/i)||text.match(/\b(\d{2,3})[ -]minute\s+(?:lesson|session)\b/i)
 const minutes=time&&Number(time[1])>=10&&Number(time[1])<=180?Number(time[1]):null
 const lines=text.split(/\r?\n/).map(clean).filter(Boolean)
 const statements=[...new Set(lines.filter(l=>/students will (?:be able to|learn|understand)/i.test(l)).map(l=>l.replace(/^\d+[.)]\s*/,'')))].slice(0,5)
 const headingNames=[...defaultSections,'Objectives','Objective','Learning target','Procedure','Assessment','Materials','Introduction','Independent practice','Guided practice','Homework','Resources','Essential question','Vocabulary']
 const candidates=lines.filter(l=>headingNames.some(h=>h.toLowerCase()===l.replace(/:$/,'').toLowerCase()))
 const headings=candidates.filter((l,i)=>candidates.findIndex(v=>v.toLowerCase().replace(/:$/,'')===l.toLowerCase().replace(/:$/,''))===i).slice(0,16)
 const sessionNumbers=[...text.matchAll(/\bSession\s+(\d+)\s*:/gi)].map(m=>Number(m[1]));const count=text.match(/\b(\d+)\s+sessions?\b/i)
 const sessions=Math.min(10,Math.max(1,...sessionNumbers,Number(count?.[1])||1))
 const first=lines.find(l=>l.length>8&&!/copy section|edit|lesson title|lesson draft|^standards$/i.test(l))||'Existing lesson'
 return {state,grade,subject,topic:first.slice(0,300),minutes,standardIds:verified?rows.map(s=>s.id):[],customCode:verified?'':'Original lesson learning goals',customStandard:verified?'':(statements.join('\n')||text.slice(0,4800)),scope:sessions>1?'unit':'lesson',sessions,objectiveCount:statements.length||1,sections:headings.length>=2?headings:defaultSections,groups:['Preserve the differentiation groups and supports in the original lesson.'],materials:'Preserve the original materials unless the requested change requires a replacement.',codes}
}

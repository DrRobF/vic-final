const clean=v=>String(v||'').trim()
const key=v=>clean(v).replace(/:$/,'').toLowerCase()
const goalHeading=/^(?:learning objectives?|objectives?|learning targets?|learning goals?|lesson objectives?|standards?(?: and (?:learning )?objectives?)?|curriculum standards?|standards alignment)$/i
const stopHeading=/^(?:session plan|session \d+.*|standard alignment|what changed.*|materials(?: and preparation)?|opening activity|teaching and modeling|guided practice|independent.*|differentiation.*|assessment.*|closure.*|procedure|methods|instruction|instructions|lesson sequence|learning activities|introduction|warm.?up|activities|resources|homework|teacher review|shared text.*|teacher model.*|questions.*|student task.*|exit ticket.*)$/i
const unique=values=>[...new Map(values.map(v=>[key(v),v])).values()]
export function extractLessonTargets(source){
 const lines=String(source||'').split(/\r?\n/).map(clean).filter(Boolean)
 const goals=[],standards=[];let section=''
 for(const line of lines){
  if(goalHeading.test(key(line))){section=/standard/i.test(line)?'standards':'objectives';continue}
  if(stopHeading.test(key(line))){section='';continue}
  const statement=line.replace(/^(?:\d+[.)]\s*)?(?:objective\s*:\s*)?/i,'')
  if(section==='objectives'&&!/^(?:standards?|activity|evidence(?: of learning)?|assessment)\s*:/i.test(statement))goals.push(statement)
  else if(!section&&/^(?:students will (?:be able to|learn|understand)|SWBAT)\b/i.test(statement))goals.push(statement)
  if(section==='standards'&&!/^(?:activity|assessment|objective|evidence)\s*:/i.test(statement))standards.push(statement)
 }
 // Exported plans repeat objectives under alignment. Prefer the objective section.
 const objectiveStart=lines.findIndex(l=>/^(?:learning objectives?|objectives?|learning targets?|learning goals?|lesson objectives?)$/i.test(key(l)))
 let objectiveLines=[]
 if(objectiveStart>=0){for(const l of lines.slice(objectiveStart+1)){if(goalHeading.test(key(l))||stopHeading.test(key(l)))break;if(!/^(?:standards?|activity|evidence(?: of learning)?|assessment)\s*:/i.test(l))objectiveLines.push(l.replace(/^\d+[.)]\s*/,''))}}
 const selected=objectiveLines.length?objectiveLines:goals
 const explicit=selected.filter(l=>/^(?:students will (?:be able to|learn|understand)|SWBAT)\b/i.test(l.replace(/^Objective\s*:\s*/i,'')))
 const objectives=unique((explicit.length?explicit:selected).map(v=>v.replace(/^Objective\s*:\s*/i,''))).slice(0,5)
 return {objectives,standardsText:unique(standards).join('\n').slice(0,5000)}
}
export function extractLessonStimulus(source){
 const lines=String(source||'').split(/\r?\n/)
 const start=lines.findIndex(l=>/^(?:shared text\s*\/\s*lesson stimulus|source material|reading passage|story passage|passage|dataset|lesson stimulus)\s*:?$/i.test(clean(l)))
 if(start<0)return ''
 const content=[]
 for(const line of lines.slice(start+1)){
  if(stopHeading.test(key(line))||goalHeading.test(key(line)))break
  content.push(line)
 }
 return content.join('\n').trim().slice(0,10000)
}

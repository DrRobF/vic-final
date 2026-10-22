// Weekly lesson planning: five daily lessons (one standard each), saved as a week the teacher can send to school leaders.
// Pure helpers shared by the week planner page, the teacher API, the principal API and tests.
export const WEEKDAYS=['Monday','Tuesday','Wednesday','Thursday','Friday']
export const WEEK_DAYS=5
export const WEEK_STATUS={draft:'Not sent yet',submitted:'Sent to administration',reviewed:'Reviewed by administration'}
export const WEEK_USER_REQUEST_LIMIT=25
export const MAX_EMAIL_SENDS_PER_DAY=5
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid=v=>typeof v==='string'&&UUID.test(v)
const text=(value,max)=>typeof value==='string'?value.trim().slice(0,max):''

function parseDay(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null
 const date=new Date(`${value}T12:00:00Z`)
 return Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==value?null:date
}
const iso=date=>date.toISOString().slice(0,10)

// Any date in a week becomes that week's Monday.
export function mondayOf(value){
 const date=parseDay(value)
 if(!date)return null
 const offset=(date.getUTCDay()+6)%7
 date.setUTCDate(date.getUTCDate()-offset)
 return iso(date)
}
export function weekDates(weekOf){
 const monday=parseDay(mondayOf(weekOf)||'')
 if(!monday)return []
 return WEEKDAYS.map((_,i)=>{const d=new Date(monday);d.setUTCDate(d.getUTCDate()+i);return iso(d)})
}
// Teachers usually plan ahead: Thursday onward defaults to next week.
export function defaultWeekOf(now=new Date()){
 const local=iso(new Date(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate(),12)))
 const monday=parseDay(mondayOf(local))
 if([0,4,5,6].includes(now.getDay()))monday.setUTCDate(monday.getUTCDate()+7)
 return iso(monday)
}
export function formatDay(value,options={weekday:'long',month:'long',day:'numeric'}){
 const date=parseDay(value)
 return date?date.toLocaleDateString('en-US',{...options,timeZone:'UTC'}):''
}
export function weekLabel(weekOf){return `Week of ${formatDay(weekOf,{month:'long',day:'numeric',year:'numeric'})}`}
// Mid-sentence form: "week of October 12, 2026" (the month stays capitalized).
export function weekPhrase(weekOf){return `week of ${formatDay(weekOf,{month:'long',day:'numeric',year:'numeric'})}`}
export function subjectLabel(subject){return subject==='math'?'Math':subject==='reading'?'Reading / ELA':String(subject||'')}
export function gradeLabel(grade){return grade==='K'?'Kindergarten':/^\d+$/.test(String(grade))?`Grade ${grade}`:String(grade||'')}

export function emptyWeekDay(){return {off:false,standardIds:[],customStandard:'',customCode:'',topic:'',lessonId:null}}

// Validates what a teacher saves for a week. Official standards must come from the shared catalogue
// for the same state, grade and subject; pasted standards stay marked as teacher-provided.
// allowEmpty lets a saved week keep days that are not planned yet (a teacher filling the week one lesson at a time).
export function normalizeWeekSetup(body,catalogue,{allowEmpty=false}={}){
 if(!body||typeof body!=='object')throw new Error('Enter your week details.')
 if(!isUuid(body.id))throw new Error('This week could not be saved. Refresh the page and try again.')
 const weekOf=mondayOf(body.weekOf)
 if(!weekOf)throw new Error('Choose the week you are planning.')
 const state=text(body.state,60),grade=text(body.grade,30),subject=text(body.subject,100)
 if(!state||!grade||!subject)throw new Error('Choose a state, grade and subject for the week.')
 const minutes=Number(body.minutes)
 if(!Number.isInteger(minutes)||minutes<10||minutes>180)throw new Error('Choose a lesson length from 10 to 180 minutes.')
 if(!Array.isArray(body.days)||body.days.length!==WEEK_DAYS)throw new Error('A week has five school days.')
 const dates=weekDates(weekOf)
 const days=body.days.map((raw,i)=>{
  const day=raw&&typeof raw==='object'?raw:{}
  const off=day.off===true
  const lessonId=isUuid(day.lessonId)?day.lessonId:null
  const topic=text(day.topic,300)
  if(off)return {index:i,date:dates[i],off:true,standardIds:[],customStandard:'',customCode:'',standards:[],topic,lessonId:null}
  const ids=Array.isArray(day.standardIds)?[...new Set(day.standardIds.filter(id=>typeof id==='string'))]:[]
  if(ids.length>3)throw new Error(`${WEEKDAYS[i]}: choose up to three standards.`)
  const standards=ids.map(id=>{
   const row=catalogue.find(r=>r.id===id)
   if(!row||row.state!==state||row.grade!==grade||row.subject!==subject)throw new Error(`${WEEKDAYS[i]}: a standard does not match this state, grade and subject. Choose it again.`)
   return {id:row.id,code:row.code,text:row.text,origin:'official'}
  })
  const customStandard=text(day.customStandard,5000),customCode=text(day.customCode,100)
  if(customStandard)standards.push({id:null,code:customCode||'Teacher-provided standard',text:customStandard,origin:'teacher'})
  if(!standards.length){
   if(allowEmpty)return {index:i,date:dates[i],off:false,standardIds:[],customStandard:'',customCode:'',standards:[],topic,lessonId:null}
   throw new Error(`${WEEKDAYS[i]}: choose a standard, plan it in the detailed lesson planner, or mark the day as no lesson.`)
  }
  return {index:i,date:dates[i],off:false,standardIds:ids,customStandard,customCode,standards,topic,lessonId}
 })
 if(!allowEmpty&&days.every(d=>d.off||!d.standards.length))throw new Error('Plan at least one day this week.')
 const settings=body.settings&&typeof body.settings==='object'?body.settings:{}
 return {id:body.id,weekOf,state,grade,subject,minutes,days,settings:{
  mode:settings.mode==='detail'?'detail':'quick',
  worksheet:settings.worksheet!==false,
  worksheetCount:[3,5,8,10].includes(Number(settings.worksheetCount))?Number(settings.worksheetCount):5,
  materials:text(settings.materials,1200),interests:text(settings.interests,1000),
  groups:Array.isArray(settings.groups)?settings.groups.slice(0,5).map(g=>text(g,500)).filter(Boolean):[],
  ...(Number.isInteger(Number(settings.classId))&&Number(settings.classId)>0?{classId:Number(settings.classId)}:{}),
 }}
}

// One row per planned standard per day: the data the future curriculum map and coverage checks read.
export function weekStandardRows(week,userId,schoolId=null){
 const rows=[]
 for(const day of week.days){
  if(day.off)continue
  const seen=new Set()
  for(const s of day.standards){
   if(seen.has(s.code))continue
   seen.add(s.code)
   rows.push({week_id:week.id,day_index:day.index,user_id:userId,school_id:schoolId,lesson_date:day.date,state:week.state,grade:week.grade,subject:week.subject,standard_code:s.code,standard_text:s.text,origin:s.origin})
  }
 }
 return rows
}

function dayFocus(day){
 const s=day.standards[0]
 return day.topic||(s?`${s.code}${s.origin==='teacher'?'':' — '+s.text.slice(0,90)}`:'a lesson the teacher is planning separately')
}
// Tells the lesson generator where this day sits in the week so the five lessons build on one another.
export function weekContextInstructions(week,index){
 const planned=week.days.filter(d=>!d.off)
 const position=planned.findIndex(d=>d.index===index)
 const before=planned.slice(0,position).map(d=>`${WEEKDAYS[d.index]}: ${dayFocus(d)}`)
 const after=planned.slice(position+1).map(d=>`${WEEKDAYS[d.index]}: ${dayFocus(d)}`)
 const parts=[`WEEK PLAN: This is ${WEEKDAYS[index]}, lesson ${position+1} of ${planned.length} in one week of ${subjectLabel(week.subject)}.`]
 if(before.length)parts.push(`Earlier this week: ${before.join('; ')}.`)
 if(after.length)parts.push(`Later this week: ${after.join('; ')}.`)
 parts.push(position>0?'Open with a brief review that connects to earlier days. Use a new passage, problem set or context; do not repeat earlier activities.':'Introduce the week with an engaging opening.')
 if(position===planned.length-1&&planned.length>1)parts.push('As the last lesson of the week, end with a short cumulative check of the week’s learning.')
 return parts.join(' ').slice(0,900)
}
// The request the planner sends to /api/lessonplan for one day of the week.
export function dayLessonRequest(week,index,{sections,instructions='',groups,materials,interests}={}){
 const day=week.days[index]
 if(!day||day.off)throw new Error('There is no lesson planned for this day.')
 const first=day.standards[0]
 const topic=day.topic||`${first.origin==='teacher'?'':first.code+': '}${first.text}`.slice(0,300)
 const combined=[weekContextInstructions(week,index),text(instructions,1500)].filter(Boolean).join('\n').slice(0,1500)
 return {weekId:week.id,state:week.state,grade:week.grade,subject:week.subject,topic,minutes:week.minutes,scope:'lesson',sessions:1,objectiveCount:2,lessonStyle:'recommend',creativeActivity:'none',startingPoint:'new',sourceLesson:'',standardIds:day.standardIds,customStandard:day.customStandard,customCode:day.customCode,materials:materials??week.settings?.materials??'',interests:interests??week.settings?.interests??'',groups:groups?.length?groups:week.settings?.groups?.length?week.settings.groups:undefined,sections,instructions:combined}
}

// The snapshot a principal receives: exactly what the teacher sent, even if the teacher edits the lessons later.
export function buildWeekSubmission(week,lessonsById,teacherName){
 const days=week.days.map(day=>{
  const base={index:day.index,date:day.date,dayName:WEEKDAYS[day.index],off:day.off,topic:day.topic,standards:day.standards.map(({code,text,origin})=>({code,text,origin}))}
  if(day.off)return base
  const saved=lessonsById.get(day.lessonId)
  if(!day.lessonId||!saved?.plan||!saved?.input)throw new Error(`${WEEKDAYS[day.index]} does not have a finished lesson yet. Build it, plan it in the detailed lesson planner, or mark it as no lesson.`)
  return {...base,lessonId:day.lessonId,title:saved.plan.title,plan:saved.plan,input:saved.input,worksheet:saved.worksheet||null}
 })
 const submission={weekOf:week.weekOf,state:week.state,grade:week.grade,subject:week.subject,minutes:week.minutes,teacherName,days}
 if(JSON.stringify(submission).length>4500000)throw new Error('This week is too large to send. Download the Word file and share it instead.')
 return submission
}

export function weekTitle(week){return `${gradeLabel(week.grade)} ${subjectLabel(week.subject)} · ${weekLabel(week.weekOf||week.week_of)}`}
export function weekFileName(week){return `Lesson-Plans-${String(week.weekOf||week.week_of)}-${String(subjectLabel(week.subject)).replace(/[^A-Za-z0-9]+/g,'-')}.docx`.replace(/-+/g,'-')}
export function validEmail(value){const v=text(value,254).toLowerCase();return /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[a-z]{2,}$/i.test(v)?v:''}

export function submissionEmail({teacherName,teacherEmail,schoolName,week,reviewUrl,days}){
 const planned=days.filter(d=>!d.off)
 const lines=[`${teacherName} sent lesson plans for the ${weekPhrase(week.weekOf)}.`,`${gradeLabel(week.grade)} · ${subjectLabel(week.subject)}${schoolName?` · ${schoolName}`:''}`,'',...days.map(d=>`${d.dayName}: ${d.off?'No lesson planned':`${d.title} (${d.standards.map(s=>s.code).join(', ')})`}`),'',`${planned.length} lesson${planned.length===1?'':'s'} with materials${planned.some(d=>d.worksheet)?', worksheets and answer keys':''} are attached as a Word document.`]
 if(reviewUrl)lines.push('',`Review and leave feedback in AskVic: ${reviewUrl}`)
 if(!reviewUrl&&teacherEmail)lines.push('',`Reply to this email to respond to ${teacherName}.`)
 lines.push('','Created with Ask VIC Lesson Designer · askvic.ai')
 return {subject:`Lesson plans: ${weekLabel(week.weekOf)} · ${gradeLabel(week.grade)} ${subjectLabel(week.subject)} · ${teacherName}`,body:lines.join('\n')}
}
export function reviewEmail({teacherName,reviewerName,week,comment}){
 const first=String(teacherName||'').trim().split(/\s+/)[0]||'there'
 const lines=[`Hi ${first},`,`${reviewerName||'Your school leader'} reviewed your lesson plans for the ${weekPhrase(week.weekOf)} (${gradeLabel(week.grade)} ${subjectLabel(week.subject)}).`]
 if(comment)lines.push(`Feedback:\n${comment}`)
 lines.push('See your weeks anytime at https://www.askvic.ai/lessonplan/week')
 return {subject:`Lesson plans reviewed: ${weekLabel(week.weekOf)}`,body:lines.join('\n\n')}
}

// Places a lesson made in the detailed single-lesson planner into one day of a week.
// The day takes the lesson's own standards and topic; the rest of the week is unchanged.
export function lessonIntoWeekDay(days,index,lessonId,input){
 if(!Number.isInteger(index)||index<0||index>=WEEK_DAYS)throw new Error('Choose a day from Monday to Friday.')
 const base=Array.isArray(days)&&days.length===WEEK_DAYS?days:Array.from({length:WEEK_DAYS},emptyWeekDay)
 const standardIds=Array.isArray(input?.standardIds)?input.standardIds.filter(id=>typeof id==='string').slice(0,3):[]
 const custom=(input?.standards||[]).find(s=>s.origin==='teacher')
 const day={off:false,standardIds,customStandard:custom?String(custom.text||'').slice(0,5000):String(input?.customStandard||'').slice(0,5000),customCode:custom?String(custom.code||'').slice(0,100):String(input?.customCode||'').slice(0,100),topic:String(input?.topic||'').slice(0,300),lessonId}
 if(day.customCode==='Teacher-provided standard')day.customCode=''
 // Moving a lesson to another day frees the day it was on.
 return base.map((d,i)=>i===index?day:{off:!!d.off,standardIds:d.standardIds||[],customStandard:d.customStandard||'',customCode:d.customCode||'',topic:d.topic||'',lessonId:d.lessonId&&d.lessonId!==lessonId?d.lessonId:null})
}

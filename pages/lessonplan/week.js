import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import VICHeader from '../../components/VICHeader'
import PlannerModeSwitch from '../../components/PlannerModeSwitch'
import { groupName } from '../../lib/levels.mjs'
import { supabase } from '../../lib/supabase'
import { persistLesson } from '../../lib/lesson-library-client'
import { lessonLink } from '../../lib/educator-lessons.mjs'
import { DEFAULT_SECTIONS, GROUP_DEFAULTS } from '../../lib/lesson-designer.mjs'
import { WEEKDAYS, WEEK_STATUS, defaultWeekOf, weekDates, mondayOf, formatDay, weekLabel, gradeLabel, subjectLabel, emptyWeekDay, normalizeWeekSetup, dayLessonRequest, validEmail } from '../../lib/lesson-week.mjs'

const GRADES=['K','1','2','3','4','5','6','7','8']
const FORMAT_KEY='vic-lesson-format-v1'
const BUILD_AT_ONCE=2
const blankWeek=()=>({id:crypto.randomUUID(),weekOf:defaultWeekOf(),state:'FL',grade:'3',subject:'math',minutes:45,days:Array.from({length:5},emptyWeekDay),settings:{mode:'quick',worksheet:true,worksheetCount:5,materials:'',interests:'',groups:GROUP_DEFAULTS.slice(0,3)}})

async function token(){const {data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw new Error('Log in to plan your week.');return session.access_token}
async function call(path,{method='GET',body}={}){
 const r=await fetch(path,{method,headers:{Authorization:`Bearer ${await token()}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})
 const d=await r.json().catch(()=>({error:r.status===504?'VIC took too long on this lesson. Try this day again.':'Something went wrong. Please try again.'}))
 if(!r.ok)throw new Error(d.error||'Something went wrong. Please try again.')
 return d
}
function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}

export default function WeekPlanner(){
 const router=useRouter()
 const [user,setUser]=useState(null),[authReady,setAuthReady]=useState(false)
 const [week,setWeek]=useState(blankWeek),[status,setStatus]=useState('draft'),[weekMeta,setWeekMeta]=useState(null)
 const [lessons,setLessons]=useState({}),[progress,setProgress]=useState({}),[building,setBuilding]=useState(false)
 const [standards,setStandards]=useState([]),[loadingStandards,setLoadingStandards]=useState(false),[search,setSearch]=useState({}),[pasteDays,setPasteDays]=useState({})
 const [history,setHistory]=useState([]),[schools,setSchools]=useState([]),[email,setEmail]=useState(''),[showEmail,setShowEmail]=useState(false)
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[format,setFormat]=useState({sections:DEFAULT_SECTIONS,instructions:''})
 const weekRef=useRef(week),saveQueue=useRef(Promise.resolve())
 weekRef.current=week

 useEffect(()=>{
  try{const saved=JSON.parse(localStorage.getItem(FORMAT_KEY)||'null');if(saved&&Array.isArray(saved.sections))setFormat({sections:saved.sections,instructions:saved.instructions||''})}catch{}
  supabase.auth.getSession().then(({data})=>{setUser(data.session?.user||null);setAuthReady(true)}).catch(()=>setAuthReady(true))
  const {data:listener}=supabase.auth.onAuthStateChange((_e,session)=>setUser(session?.user||null))
  return()=>listener?.subscription?.unsubscribe()
 },[])
 async function loadHistory(){try{const d=await call('/api/lessonplan/weeks');setHistory(d.weeks);setSchools(d.schools)}catch(e){setError(e.message)}}
 useEffect(()=>{if(user)loadHistory()},[user?.id])
 useEffect(()=>{
  if(!user||!router.isReady||!router.query.id)return
  let active=true;setBusy('Opening your week…')
  call(`/api/lessonplan/weeks?id=${encodeURIComponent(router.query.id)}`).then(d=>{if(!active)return;const w=d.week;setWeek({id:w.id,weekOf:w.weekOf,state:w.state,grade:w.grade,subject:w.subject,minutes:w.minutes,days:w.days.map(day=>({off:!!day.off,standardIds:day.standardIds||[],customStandard:day.customStandard||'',customCode:day.customCode||'',topic:day.topic||'',lessonId:day.lessonId||null})),settings:{mode:w.settings?.mode==='detail'?'detail':'quick',worksheet:w.settings?.worksheet!==false,worksheetCount:w.settings?.worksheetCount||5,materials:w.settings?.materials||'',interests:w.settings?.interests||'',groups:w.settings?.groups?.length?w.settings.groups:GROUP_DEFAULTS.slice(0,3)}});setPasteDays(Object.fromEntries(w.days.map((day,i)=>[i,!!day.customStandard&&!day.standardIds?.length])));setLessons(d.lessons);setStatus(w.status);setWeekMeta(w);setProgress({})}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setBusy('')})
  return()=>{active=false}
 },[user?.id,router.isReady,router.query.id])

 const builtIn=['FL','PA'].includes(week.state)&&GRADES.includes(week.grade)&&['math','reading'].includes(week.subject)
 useEffect(()=>{
  let cancelled=false;setStandards([])
  if(!builtIn)return
  setLoadingStandards(true)
  fetch(`/api/lessonplan/standards?state=${week.state}&grade=${week.grade}&subject=${week.subject}`).then(r=>r.json()).then(d=>{if(!cancelled)setStandards(d.standards||[])}).catch(()=>{if(!cancelled)setError('Could not load standards. You can paste them instead.')}).finally(()=>{if(!cancelled)setLoadingStandards(false)})
  return()=>{cancelled=true}
 },[week.state,week.grade,week.subject,builtIn])

 const dates=weekDates(week.weekOf)
 const planned=week.days.map((d,i)=>({...d,index:i})).filter(d=>!d.off)
 const builtCount=planned.filter(d=>d.lessonId).length
 const buildable=planned.filter(d=>!d.lessonId&&hasStandard(d,d.index)).length
 const allBuilt=planned.length>0&&builtCount===planned.length
 const locked=building||!!busy
 const detail=week.settings.mode==='detail'
 const editedSinceSent=status!=='draft'&&!!weekMeta?.submittedAt&&(weekMeta.editedAfterSubmit||planned.some(d=>d.lessonId&&lessons[d.lessonId]?.updatedAt&&Date.parse(lessons[d.lessonId].updatedAt)>Date.parse(weekMeta.submittedAt)))

 function update(patch){setWeek(w=>({...w,...patch}));setError('')}
 function updateDay(i,patch,{rebuild=false}={}){setWeek(w=>({...w,days:w.days.map((d,n)=>n===i?{...d,...patch,...(rebuild&&d.lessonId?{lessonId:null}:{})}:d)}));if(rebuild&&week.days[i].lessonId)setNotice(`${WEEKDAYS[i]} changed, so it will be rebuilt. The earlier version stays in My Lessons.`);setError('')}
 function changeTarget(key,value){
  if(week.days.some(d=>d.lessonId)&&!window.confirm('Changing the state, grade or subject clears the standards and lessons for this week so VIC can rebuild them. Your earlier lessons stay in My Lessons. Continue?'))return
  setWeek(w=>({...w,[key]:value,days:w.days.map(d=>({...d,standardIds:[],lessonId:null}))}));setPasteDays({})
 }
 function settings(patch){setWeek(w=>({...w,settings:{...w.settings,...patch}}))}
 function requestBody(w=weekRef.current){return {id:w.id,weekOf:w.weekOf,state:w.state.trim(),grade:w.grade.trim(),subject:w.subject.trim(),minutes:Number(w.minutes),days:w.days.map((d,i)=>({off:d.off,standardIds:pasteDays[i]?[]:d.standardIds,customStandard:pasteDays[i]||!builtIn?d.customStandard:'',customCode:pasteDays[i]||!builtIn?d.customCode:'',topic:d.topic,lessonId:d.lessonId})),settings:w.settings}}
 function saveWeek(){
  const next=saveQueue.current.catch(()=>{}).then(()=>call('/api/lessonplan/weeks',{method:'POST',body:{action:'save',week:requestBody()}}))
  saveQueue.current=next
  return next
 }

 async function buildDay(index,normalized){
  const w=weekRef.current
  setProgress(p=>({...p,[index]:{step:'lesson'}}))
  try{
   const groups=w.settings.groups.map(g=>g.trim()).filter(Boolean)
   const body=dayLessonRequest(normalized,index,{sections:format.sections,instructions:format.instructions,groups:groups.length?groups:GROUP_DEFAULTS.slice(0,3),materials:w.settings.materials,interests:w.settings.interests})
   const lesson=await call('/api/lessonplan',{method:'POST',body})
   let worksheet,worksheetNote=''
   if(w.settings.worksheet){
    setProgress(p=>({...p,[index]:{step:'worksheet'}}))
    try{const d=await call('/api/lessonplan',{method:'POST',body:{...lesson.input,kind:'worksheet',plan:lesson.plan,worksheetCount:w.settings.worksheetCount,worksheetDifferentiated:false,worksheetNotes:'',weekId:w.id}});worksheet=d.worksheet}
    catch(e){worksheetNote='The worksheet could not be created. Open the lesson to try it again.'}
   }
   setProgress(p=>({...p,[index]:{step:'saving'}}))
   const savedLessonId=crypto.randomUUID()
   await persistLesson({plan:lesson.plan,input:lesson.input,createdAt:lesson.createdAt,...(worksheet?{worksheet}:{}),savedLessonId,week:{id:w.id,day:index}},user.id)
   setWeek(cur=>({...cur,days:cur.days.map((d,n)=>n===index?{...d,lessonId:savedLessonId}:d)}))
   weekRef.current={...weekRef.current,days:weekRef.current.days.map((d,n)=>n===index?{...d,lessonId:savedLessonId}:d)}
   setLessons(l=>({...l,[savedLessonId]:{title:lesson.plan.title,worksheet:!!worksheet,updatedAt:new Date().toISOString()}}))
   await saveWeek()
   setProgress(p=>({...p,[index]:{step:'done',note:worksheetNote}}))
  }catch(e){setProgress(p=>({...p,[index]:{step:'error',note:e.message}}))}
 }
 async function build(indexes){
  if(locked)return
  setError('');setNotice('')
  let normalized
  try{normalized=normalizeWeekSetup(requestBody(),standards,{allowEmpty:true})}catch(e){setError(e.message);return}
  indexes=indexes.filter(i=>normalized.days[i]&&!normalized.days[i].off&&normalized.days[i].standards.length)
  if(!indexes.length){setError('Choose a standard for each day first.');return}
  setBuilding(true)
  try{
   await saveWeek()
   const queue=[...indexes]
   const worker=async()=>{while(queue.length){const i=queue.shift();await buildDay(i,normalized)}}
   await Promise.all(Array.from({length:Math.min(BUILD_AT_ONCE,queue.length)},worker))
   setNotice('Your week is ready. Open any day to review or edit it, then download or send it to administration.')
   loadHistory()
  }catch(e){setError(e.message)}
  finally{setBuilding(false)}
 }
 function hasStandard(d,i){return pasteDays[i]||!builtIn?!!d.customStandard.trim():d.standardIds.length>0}
 function buildMissing(){const needs=planned.filter(d=>!d.lessonId&&!hasStandard(d,d.index)).map(d=>WEEKDAYS[d.index]);if(needs.length){setError(`Choose a standard for ${needs.join(', ')} first — or plan ${needs.length===1?'it':'them'} in detail.`);return}const missing=planned.filter(d=>!d.lessonId).map(d=>d.index);if(!missing.length){setNotice('Every planned day already has a lesson. Use Redo on any day to rebuild it.');return}build(missing)}
 async function planInDetail(i){
  if(locked)return
  setBusy('Saving your week…');setError('')
  try{await saveWeek();window.location.href=`/lessonplan?weekId=${encodeURIComponent(week.id)}&day=${i}`}
  catch(e){setError(e.message);setBusy('')}
 }
 function redo(i){if(!window.confirm(`Rebuild ${WEEKDAYS[i]}? The current version stays in My Lessons.`))return;updateDay(i,{lessonId:null});weekRef.current={...weekRef.current,days:weekRef.current.days.map((d,n)=>n===i?{...d,lessonId:null}:d)};build([i])}

 async function downloadWeek(){
  setBusy('Preparing your Word document…');setError('')
  try{await saveWeek();const r=await fetch(`/api/lessonplan/weeks?id=${encodeURIComponent(week.id)}&format=docx`,{headers:{Authorization:`Bearer ${await token()}`}});if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||'Could not prepare the download.')}download(await r.blob(),`Lesson-Plans-${week.weekOf}.docx`)}
  catch(e){setError(e.message)}finally{setBusy('')}
 }
 async function send(target){
  if(target.email&&!validEmail(target.email)){setError('Enter your principal’s email address.');return}
  setBusy('Sending your week…');setError('');setNotice('')
  try{
   await saveWeek()
   const d=await call('/api/lessonplan/weeks',{method:'POST',body:{action:'submit',id:week.id,...target}})
   setStatus('submitted');setWeekMeta(m=>({...(m||{}),submittedAt:d.submittedAt,schoolName:d.school,sentToEmail:target.email||'',editedAfterSubmit:false}))
   setNotice(d.school?`Sent to ${d.school} administration.${d.emailed?' Your principal also got an email with the Word file attached.':d.note?' '+d.note:''}`:`Sent to ${target.email} with the Word file attached.`)
   loadHistory();window.scrollTo({top:0,behavior:'smooth'})
  }catch(e){setError(e.message)}finally{setBusy('')}
 }
 function newWeek(){if(locked)return;setWeek(blankWeek());setLessons({});setProgress({});setStatus('draft');setWeekMeta(null);setPasteDays({});setNotice('');setError('');router.push('/lessonplan/week',undefined,{shallow:true})}
 async function removeWeek(w){if(!window.confirm(`Remove the ${weekLabel(w.weekOf).toLowerCase()} plan? Its lessons stay in My Lessons.`))return;try{await call('/api/lessonplan/weeks',{method:'POST',body:{action:'delete',id:w.id}});if(w.id===week.id)newWeek();loadHistory()}catch(e){setError(e.message)}}

 const stepLabel={lesson:'Designing the lesson…',worksheet:'Creating the worksheet and answer key…',saving:'Saving…',done:'Ready',error:'Not finished'}
 const stateChoice=['FL','PA'].includes(week.state)?week.state:'other',gradeChoice=GRADES.includes(week.grade)?week.grade:'other',subjectChoice=['math','reading'].includes(week.subject)?week.subject:'other'

 return <><Head><title>Weekly Lesson Planner for Teachers | Ask VIC</title><meta name="description" content="Plan a full week of standards-based lessons in one step: a different standard each day, with materials, worksheets and answer keys. Download the week or send it to your principal."/><link rel="canonical" href="https://www.askvic.ai/lessonplan/week"/></Head>
 <div className="wk-shell"><VICHeader currentPath="/lessonplan"/>
 {(building||busy)&&<div className="wk-working" role="status" aria-live="polite"><div className="wk-working-card"><div className="wk-spinner" aria-hidden="true"/><h2>{busy||`Building your week · ${builtCount} of ${planned.length} days ready`}</h2><p>{building?'VIC builds two days at a time. A full week usually takes 5–10 minutes. Keep this page open.':'One moment…'}</p>{building&&<ul className="wk-progress">{planned.map(d=><li key={d.index} className={progress[d.index]?.step||(d.lessonId?'done':'')}><strong>{WEEKDAYS[d.index]}</strong><span>{progress[d.index]?stepLabel[progress[d.index].step]:d.lessonId?'Ready':'Waiting…'}</span></li>)}</ul>}</div></div>}
 <main>
 <section className="wk-hero"><div><span className="wk-eyebrow">ASK VIC · WEEKLY PLANNER</span><h1>Plan the whole week.<br/><em>One standard a day.</em></h1><p>Pick a standard for each day. VIC builds five connected lessons with materials, a worksheet and an answer key for every day. Download the week, or send it straight to your administration.</p><PlannerModeSwitch current="/lessonplan/week"/><div className="wk-actions wk-hero-links"><button type="button" className="wk-outline" onClick={newWeek} disabled={locked}>Start a new week</button><a href="/educator">My Lessons</a></div></div></section>
 {!authReady?<p>Checking your sign-in…</p>:!user?<div className="wk-banner"><a href="/login?next=/lessonplan/week">Log in</a> or <a href="/signup">sign up free</a> to plan your week.</div>:null}
 <div role="alert" className={error?'wk-message wk-error':'wk-hidden'}>{error}</div><div role="status" aria-live="polite" className={notice?'wk-message':'wk-hidden'}>{notice}</div>

 {user&&history.length>0&&<details className="wk-panel wk-history"><summary>My weeks ({history.length})</summary><ul>{history.map(h=><li key={h.id} className={h.id===week.id?'current':''}><div><strong>{weekLabel(h.weekOf)}</strong><span>{gradeLabel(h.grade)} · {subjectLabel(h.subject)}</span></div><span className={`wk-badge ${h.status}`}>{WEEK_STATUS[h.status]}{h.status!=='draft'&&(h.schoolName||h.sentToEmail)?` · ${h.schoolName||h.sentToEmail}`:''}</span>{h.principalComment&&<p className="wk-comment"><strong>{h.reviewerName||'Administration'}:</strong> {h.principalComment}</p>}<div className="wk-actions"><a href={`/lessonplan/week?id=${h.id}`}>Open</a>{h.status==='draft'&&<button type="button" className="wk-text" onClick={()=>removeWeek(h)}>Remove</button>}</div></li>)}</ul></details>}

 {status!=='draft'&&weekMeta&&<div className={`wk-panel wk-sent ${status}`}><strong>{WEEK_STATUS[status]}</strong>{weekMeta.submittedAt&&<span> · {new Date(weekMeta.submittedAt).toLocaleString()}{weekMeta.schoolName?` · ${weekMeta.schoolName}`:weekMeta.sentToEmail?` · ${weekMeta.sentToEmail}`:''}</span>}{weekMeta.principalComment&&<p className="wk-comment"><strong>{weekMeta.reviewerName||'Administration'}:</strong> {weekMeta.principalComment}</p>}{editedSinceSent?<p className="wk-comment">You changed this week after sending it. Send it again so your administration sees the latest version.</p>:<small>Changed something after sending? Send the week again so your administration sees the latest version.</small>}</div>}

 {authReady&&<>
 <form className="wk-panel" onSubmit={e=>{e.preventDefault();buildMissing()}}>
  <div className="wk-title"><span>1</span><h2>Your week</h2></div>
  <div className="wk-grid">
   <label>Week of<input type="date" required value={week.weekOf} disabled={locked} onChange={e=>update({weekOf:mondayOf(e.target.value)||week.weekOf})}/><small>Monday {formatDay(dates[0],{month:'short',day:'numeric'})} – Friday {formatDay(dates[4],{month:'short',day:'numeric'})}</small></label>
   <label>State<select value={stateChoice} disabled={locked} onChange={e=>changeTarget('state',e.target.value==='other'?'':e.target.value)}><option value="FL">Florida</option><option value="PA">Pennsylvania</option><option value="other">Another state or curriculum</option></select></label>
   {stateChoice==='other'&&<label>State or curriculum name<input required maxLength="60" value={week.state} disabled={locked} onChange={e=>update({state:e.target.value})} placeholder="Texas, Ohio, IB…"/></label>}
   <label>Grade<select value={gradeChoice} disabled={locked} onChange={e=>changeTarget('grade',e.target.value==='other'?'':e.target.value)}>{GRADES.map(g=><option key={g} value={g}>{gradeLabel(g)}</option>)}<option value="other">Another grade or course</option></select></label>
   {gradeChoice==='other'&&<label>Grade or course<input required maxLength="30" value={week.grade} disabled={locked} onChange={e=>update({grade:e.target.value})} placeholder="Grade 10 or Biology"/></label>}
   <label>Subject<select value={subjectChoice} disabled={locked} onChange={e=>changeTarget('subject',e.target.value==='other'?'':e.target.value)}><option value="math">Math</option><option value="reading">Reading / ELA</option><option value="other">Another subject</option></select></label>
   {subjectChoice==='other'&&<label>Subject name<input required maxLength="100" value={week.subject} disabled={locked} onChange={e=>update({subject:e.target.value})} placeholder="Science, social studies…"/></label>}
   <label>Minutes per lesson<input type="number" min="10" max="180" required value={week.minutes} disabled={locked} onChange={e=>update({minutes:Number(e.target.value)})}/></label>
  </div>

  <div className="wk-title"><span>2</span><h2>How do you want to plan this week?</h2></div>
  <div className="wk-modes" role="radiogroup" aria-label="Planning style">
   <button type="button" role="radio" aria-checked={!detail} className={!detail?'active':''} disabled={locked} onClick={()=>settings({mode:'quick'})}><strong>⚡ Quick week</strong><span>Pick a standard for each day. One click and VIC builds all five lessons with worksheets.</span></button>
   <button type="button" role="radio" aria-checked={detail} className={detail?'active':''} disabled={locked} onClick={()=>settings({mode:'detail'})}><strong>✏️ Day by day</strong><span>Plan each day yourself in the detailed lesson planner, with every option. VIC holds the week until all five are done.</span></button>
  </div>
  <div className="wk-title"><span>3</span><h2>{detail?'Your five days':'A standard for each day'}</h2></div>
  <p className="wk-help">{detail?'Open any day to plan it in detail. Come back anytime — your week saves as you go. Mark holidays and test days as no lesson.':'Choose a different standard for each day, or the same one to keep practicing. Mark holidays and test days as no lesson.'}</p>
  <div className="wk-days">{week.days.map((day,i)=>{
   const p=progress[i],lesson=day.lessonId&&lessons[day.lessonId],paste=!builtIn||pasteDays[i]
   const query=(search[i]||'').toLowerCase(),visible=standards.filter(s=>!query||`${s.code} ${s.text}`.toLowerCase().includes(query))
   const chosen=standards.find(s=>s.id===day.standardIds[0])
   return <article key={i} className={`wk-day ${day.off?'off':''}`}>
    <header><div><h3>{WEEKDAYS[i]}</h3><small>{formatDay(dates[i],{month:'short',day:'numeric'})}</small></div><label className="wk-check"><input type="checkbox" checked={day.off} disabled={locked} onChange={e=>updateDay(i,{off:e.target.checked},{rebuild:true})}/> No lesson</label></header>
    {day.off?<p className="wk-help">No lesson planned — holiday, testing or another event.</p>:<>
     {!detail&&<>{!paste?<>
      <label>Find a standard<input value={search[i]||''} disabled={locked} onChange={e=>setSearch(s=>({...s,[i]:e.target.value}))} placeholder="Code or keyword"/></label>
      <label className="wk-sr" htmlFor={`std-${i}`}>Standard for {WEEKDAYS[i]}</label>
      <select id={`std-${i}`} value={day.standardIds[0]||''} disabled={locked||loadingStandards} onChange={e=>updateDay(i,{standardIds:e.target.value?[e.target.value]:[]},{rebuild:true})}><option value="">{loadingStandards?'Loading standards…':`Choose a standard (${visible.length})`}</option>{chosen&&!visible.includes(chosen)&&<option value={chosen.id}>{chosen.code} — {chosen.text.slice(0,120)}</option>}{visible.map(s=><option key={s.id} value={s.id}>{s.code} — {s.text.slice(0,120)}</option>)}</select>
      {chosen&&<p className="wk-standard">{chosen.text}</p>}
      {builtIn&&<button type="button" className="wk-text" disabled={locked} onClick={()=>{setPasteDays(d=>({...d,[i]:true}));updateDay(i,{standardIds:[]},{rebuild:true})}}>Paste a standard instead</button>}
     </>:<>
      <label>Standard code (optional)<input maxLength="100" value={day.customCode} disabled={locked} onChange={e=>updateDay(i,{customCode:e.target.value},{rebuild:true})} placeholder="Official identifier"/></label>
      <label>Standard wording<textarea rows="3" maxLength="5000" value={day.customStandard} disabled={locked} onChange={e=>updateDay(i,{customStandard:e.target.value},{rebuild:true})} placeholder="Paste the standard for this day"/></label>
      {builtIn&&<button type="button" className="wk-text" disabled={locked} onClick={()=>{setPasteDays(d=>({...d,[i]:false}));updateDay(i,{customStandard:'',customCode:''},{rebuild:true})}}>Choose from the list instead</button>}
     </>}
     <label>Topic or focus (optional)<input maxLength="300" value={day.topic} disabled={locked} onChange={e=>updateDay(i,{topic:e.target.value},{rebuild:true})} placeholder="e.g. Review day, word problems, quiz"/></label></>}
     <div className={`wk-day-status ${p?.step||(lesson?'done':'')}`}>
      {p&&p.step!=='done'?<span>{stepLabel[p.step]}{p.note?` ${p.note}`:''}</span>:lesson?<><span>✓ {lesson.title}{lesson.worksheet?' · worksheet + answer key':''}</span>{p?.note&&<small>{p.note}</small>}<div className="wk-actions"><a href={lessonLink(day.lessonId)} target="_blank" rel="noopener noreferrer">Open &amp; edit ↗</a>{detail?<button type="button" className="wk-text" disabled={locked} onClick={()=>planInDetail(i)}>Re-plan in detail</button>:<button type="button" className="wk-text" disabled={locked} onClick={()=>redo(i)}>Redo this day</button>}</div></>:detail?<><span>Not planned yet</span><button type="button" className="wk-primary wk-plan-day" disabled={locked} onClick={()=>planInDetail(i)}>Plan {WEEKDAYS[i]} →</button></>:<><span>{hasStandard(day,i)?'Ready to build':'Choose a standard above'}</span><button type="button" className="wk-text wk-detail" disabled={locked} onClick={()=>planInDetail(i)}>or plan this day in detail</button></>}
      {p?.step==='error'&&<button type="button" className="wk-text" disabled={locked} onClick={()=>build([i])}>Try this day again</button>}
     </div>
    </>}
   </article>})}</div>

  <div className="wk-title"><span>4</span><h2>Your classroom</h2></div>{detail&&<p className="wk-help">These fill in automatically each time you open a day in the detailed planner.</p>}
  <div className="wk-grid">
   <label>Materials available (optional)<textarea rows="2" maxLength="1200" value={week.settings.materials} disabled={locked} onChange={e=>settings({materials:e.target.value})} placeholder="Paper, counters, no devices…"/></label>
   <label>Interests or context (optional)<textarea rows="2" maxLength="1000" value={week.settings.interests} disabled={locked} onChange={e=>settings({interests:e.target.value})} placeholder="Sports, animals, our community…"/></label>
  </div>
  <label>Learning levels<select value={week.settings.groups.length} disabled={locked} onChange={e=>{const n=Number(e.target.value);settings({groups:Array.from({length:n},(_,i)=>week.settings.groups[i]||GROUP_DEFAULTS[i])})}}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n===3?'3 levels: Support, On level, Enrichment':`${n} ${n===1?'level (whole class)':'levels'}`}</option>)}</select></label>
  {week.settings.groups.map((g,i)=><label key={i}>{groupName(g,i)} — what these students need<textarea rows="2" maxLength="500" value={g} disabled={locked} onChange={e=>settings({groups:week.settings.groups.map((v,n)=>n===i?e.target.value:v)})}/></label>)}
  <small>Describe needs generally. Leave out student names and records.</small>
  {!detail&&<><div className="wk-box"><label className="wk-check"><input type="checkbox" checked={week.settings.worksheet} disabled={locked} onChange={e=>settings({worksheet:e.target.checked})}/> Include a student worksheet and answer key for each day</label>{week.settings.worksheet&&<label>Questions per worksheet<select value={week.settings.worksheetCount} disabled={locked} onChange={e=>settings({worksheetCount:Number(e.target.value)})}>{[3,5,8,10].map(n=><option key={n} value={n}>{n} questions</option>)}</select></label>}<small>Lessons use your saved school format from the single-lesson planner ({format.sections.length} sections).</small></div>

  <button className="wk-primary wk-build" disabled={!user||locked||allBuilt||!planned.length}>{building?'Building your week…':allBuilt?'✓ All days are built':builtCount===0?`⚡ Build my week · ${planned.length} lesson${planned.length===1?'':'s'}`:`⚡ Build the remaining ${planned.length-builtCount} day${planned.length-builtCount===1?'':'s'}`}</button>
  <small className="wk-center">AI creates drafts. Review every lesson before you teach or send it.</small></>}
 </form>

 <section className="wk-panel">
  <div className="wk-title"><span>5</span><h2>Download or send to administration</h2></div>
  {!allBuilt?<p className="wk-help">Finish every day first: build it with VIC, plan it in the detailed lesson planner, or mark it as no lesson ({builtCount} of {planned.length} ready). Then download the whole week as one Word document or send it.</p>:<>
   <p className="wk-help">One Word document: week at a glance, then each day’s lesson, worksheet and answer key. If you edit a lesson, the download and anything you send include your edits.</p>
   <div className="wk-actions"><button type="button" className="wk-primary" disabled={locked} onClick={downloadWeek}>Download the week (Word)</button></div>
   {schools.map(s=><div key={s.id} className="wk-send"><div><strong>Send to {s.name} administration</strong><small>Your school leaders see this week in AskVic and get an email with the Word file attached. They see only weeks you send.</small></div><button type="button" className="wk-primary" disabled={locked} onClick={()=>send({schoolId:s.id})}>{status==='draft'?'Send lesson plans':'Send again'}</button></div>)}
   {(!schools.length||showEmail)?<div className="wk-send"><label>{schools.length?'Or email the week to':'Your principal’s email'}<input type="email" maxLength="254" value={email} disabled={locked} onChange={e=>setEmail(e.target.value)} placeholder="principal@school.org"/></label><button type="button" className="wk-primary" disabled={locked||!email} onClick={()=>send({email})}>Email lesson plans</button>{!schools.length&&<small>Does your school use AskVic? <a href="/join">Join with your school’s code</a> so plans go straight to your principal’s dashboard.</small>}</div>:<button type="button" className="wk-text" onClick={()=>setShowEmail(true)}>Email the week to someone else instead</button>}
  </>}
 </section>
 </>}
 </main>
 <footer className="wk-footer">Designed by Dr. Rob Furman · <a href="/lessonplan/standards">Official standards</a></footer>
 </div>
 <style jsx global>{`
 .wk-shell{max-width:1200px;margin:auto;padding:18px 28px 40px}.wk-hero{display:grid;grid-template-columns:1fr;gap:40px;align-items:center;padding:40px 8px 28px}.wk-eyebrow{font-size:13px;letter-spacing:.12em;font-weight:800;color:var(--vic-primary)}.wk-hero h1{font-size:clamp(34px,4vw,56px);letter-spacing:-.04em;line-height:1.06;margin:14px 0 18px}.wk-hero em{font-style:normal;color:var(--vic-primary)}.wk-hero p{font-size:17px;line-height:1.6;color:var(--vic-text-secondary);max-width:620px}
 .wk-hero-links{margin-top:16px}
 .wk-panel{border:1px solid var(--vic-border);background:var(--vic-surface);border-radius:18px;box-shadow:var(--vic-shadow-soft);padding:24px;margin-bottom:20px}.wk-title{display:flex;align-items:center;gap:12px;margin:26px 0 14px}.wk-title:first-child{margin-top:0}.wk-title span{display:grid;place-items:center;background:var(--vic-primary-soft);color:var(--vic-primary);border-radius:10px;width:32px;height:32px;font-weight:800}.wk-title h2{font-size:19px;margin:0}
 .wk-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0 14px}.wk-panel label{display:block;font-size:14px;font-weight:750;margin:10px 0}.wk-panel input:not([type=checkbox]),.wk-panel select,.wk-panel textarea{display:block;width:100%;border:1px solid var(--vic-border);background:#fff;border-radius:8px;padding:10px 12px;font-size:14px;line-height:1.5;color:var(--vic-text-primary);margin-top:6px;font-family:inherit}.wk-panel small,.wk-help{display:block;color:var(--vic-text-secondary);font-size:14px;line-height:1.5;margin-top:6px}
 .wk-days{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}.wk-day{border:1px solid var(--vic-border);border-radius:14px;padding:16px;background:var(--vic-bg)}.wk-day.off{opacity:.7}.wk-day header{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}.wk-day h3{margin:0;font-size:17px}.wk-standard{font-size:14px;line-height:1.5;background:var(--vic-accent-soft);padding:10px;border-radius:8px;margin:8px 0}
 .wk-day-status{margin-top:12px;padding:10px;border-radius:8px;background:var(--vic-surface-muted);font-size:14px;line-height:1.5}.wk-day-status.done{background:var(--vic-success-soft)}.wk-day-status.error{background:var(--vic-danger-soft)}.wk-day-status.lesson,.wk-day-status.worksheet,.wk-day-status.saving{background:var(--vic-primary-soft)}
 .wk-check{display:flex!important;gap:8px;align-items:center;margin:0!important}.wk-check input{width:18px;height:18px;margin:0}.wk-box{padding:14px;background:var(--vic-surface-muted);border-radius:10px;margin:14px 0}
 .wk-primary,.wk-outline,.wk-text{border-radius:9px;padding:10px 14px;font-weight:750;font-size:14px;cursor:pointer;font-family:inherit}.wk-primary{border:1px solid var(--vic-primary);background:var(--vic-primary);color:#fff}.wk-primary:hover{background:var(--vic-primary-hover)}.wk-outline{border:1px solid var(--vic-border);background:var(--vic-surface);color:var(--vic-text-primary)}.wk-text{border:0;background:transparent;color:var(--vic-primary);padding:6px 0}.wk-shell button:disabled{opacity:.55;cursor:not-allowed}.wk-build{width:100%;font-size:16px;padding:15px;margin-top:20px}.wk-center{text-align:center}
 .wk-actions{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:6px}.wk-actions a{font-weight:700;color:var(--vic-primary)}.wk-send{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;padding:16px;border:1px solid var(--vic-border);border-radius:12px;margin-top:14px}.wk-send label{flex:1;min-width:220px;margin:0}
 .wk-banner,.wk-message{padding:12px 16px;border-radius:10px;margin:12px 0;font-size:14px;background:var(--vic-success-soft)}.wk-banner{background:var(--vic-surface);border:1px solid var(--vic-border)}.wk-error{background:var(--vic-danger-soft);color:#0D368F}.wk-hidden{display:none}
 .wk-history summary{cursor:pointer;font-weight:800;font-size:16px}.wk-history ul{list-style:none;padding:0;margin:12px 0 0}.wk-history li{display:grid;grid-template-columns:1fr auto;gap:6px 12px;padding:12px 0;border-top:1px solid var(--vic-border-soft)}.wk-history li.current{background:var(--vic-primary-soft);border-radius:8px;padding:12px}.wk-history li div:first-child span{display:block;font-size:14px;color:var(--vic-text-secondary)}.wk-history .wk-comment,.wk-history .wk-actions{grid-column:1/-1}
 .wk-badge{font-size:13px;font-weight:700;padding:5px 10px;border-radius:20px;background:var(--vic-surface-muted);height:fit-content}.wk-badge.submitted{background:var(--vic-primary-soft);color:var(--vic-primary)}.wk-badge.reviewed{background:var(--vic-success-soft);color:#35415E}.wk-comment{font-size:14px;line-height:1.5;background:var(--vic-accent-soft);padding:10px;border-radius:8px;margin:6px 0}
 .wk-sent{background:var(--vic-primary-soft)}.wk-sent.reviewed{background:var(--vic-success-soft)}
 .wk-working{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:#fff9;backdrop-filter:blur(2px);padding:24px}.wk-working-card{width:min(440px,100%);background:var(--vic-surface);border:1px solid var(--vic-border);border-radius:20px;padding:32px;text-align:center;box-shadow:0 16px 60px #0002}.wk-working-card h2{font-size:20px;margin:18px 0 10px}.wk-working-card p{font-size:14px;line-height:1.6;color:var(--vic-text-secondary)}.wk-spinner{width:48px;height:48px;margin:auto;border:5px solid var(--vic-border-soft);border-top-color:var(--vic-primary);border-radius:50%;animation:wk-spin 1s linear infinite}@keyframes wk-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.wk-spinner{animation:none}}
 .wk-progress{list-style:none;padding:0;margin:16px 0 0;text-align:left}.wk-progress li{display:flex;justify-content:space-between;gap:10px;padding:7px 10px;border-radius:8px;font-size:14px;margin-top:4px;background:var(--vic-surface-muted)}.wk-progress li.done{background:var(--vic-success-soft)}.wk-progress li.error{background:var(--vic-danger-soft)}.wk-progress li.lesson,.wk-progress li.worksheet,.wk-progress li.saving{background:var(--vic-primary-soft)}
 .wk-detail{display:block;text-align:left;margin-top:6px;font-size:14px}.wk-plan-day{display:block;width:100%;margin-top:10px}
 .wk-modes{display:grid;grid-template-columns:1fr 1fr;gap:12px}.wk-modes button{text-align:left;border:2px solid var(--vic-border);background:var(--vic-surface);border-radius:14px;padding:16px 18px;cursor:pointer;font-family:inherit;color:var(--vic-text-primary)}.wk-modes button strong{display:block;font-size:17px;margin-bottom:6px}.wk-modes button span{display:block;font-size:14px;line-height:1.5;color:var(--vic-text-secondary)}.wk-modes button.active{border-color:var(--vic-primary);background:var(--vic-primary-soft)}@media(max-width:640px){.wk-modes{grid-template-columns:1fr}}
 .wk-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}.wk-footer{text-align:center;margin-top:30px;font-size:13px;color:var(--vic-text-secondary)}
 @media(max-width:760px){.wk-shell{padding:12px 16px 30px}.wk-hero{grid-template-columns:1fr;gap:20px;padding:26px 0}.wk-panel{padding:18px}.wk-hero h1{font-size:36px}}
 `}</style></>
}

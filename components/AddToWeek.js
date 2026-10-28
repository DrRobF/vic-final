import { useEffect, useState } from 'react'
import { WEEKDAYS, defaultWeekOf, mondayOf, weekDates, formatDay, weekLabel, weekPhrase } from '../lib/lesson-week.mjs'
import { listWeeks, addLessonToWeek } from '../lib/lesson-week-client'

// Which week and day hold this lesson, read from the teacher's saved weeks.
export function lessonHome(weeks,lessonId){
 for(const w of weeks||[]){const day=(w.days||[]).findIndex(d=>d.lessonId===lessonId);if(day>=0)return {id:w.id,weekOf:w.weekOf,day}}
 return null
}

// "Add to my week" for a lesson made in the detailed single-lesson planner. Shows one short status line
// when the lesson is already in a week, and a small panel (opened from the toolbar) to choose the week and day.
export default function AddToWeek({draft,targetDay,targetWeekOf,targetWeekId,open,onToggle,beforeAdd,onAdded,disabled}){
 const [weeks,setWeeks]=useState([]),[loaded,setLoaded]=useState(false),[classes,setClasses]=useState([])
 const [chosenWeek,setChosenWeek]=useState('')
 // Start on the day this lesson belongs to: where it already is, or the week day the teacher opened it from.
 const [weekOf,setWeekOf]=useState(draft?.week?.weekOf||targetWeekOf||defaultWeekOf()),[day,setDay]=useState(Number.isInteger(draft?.week?.day)?draft.week.day:Number.isInteger(targetDay)?targetDay:0)
 const [picked,setPicked]=useState(Number.isInteger(draft?.week?.day)||Number.isInteger(targetDay))
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 const [newClass,setNewClass]=useState('')
 const refresh=()=>listWeeks().then(d=>{setWeeks(d.weeks||[]);setClasses(d.classes||[]);setLoaded(true)}).catch(()=>setLoaded(true))
 useEffect(()=>{refresh()},[draft?.savedLessonId])
 const home=lessonHome(weeks,draft?.savedLessonId)
 useEffect(()=>{if(open&&home){setWeekOf(home.weekOf);setDay(home.day)}},[open])
 // Same choice the server makes: the week the teacher came from, else a week still being planned, else any.
 const same=weeks.filter(w=>w.weekOf===weekOf&&w.subject===draft?.input?.subject&&w.grade===draft?.input?.grade)
 // Now that a week can name its class, one grade and subject can have several weeks in it -- one
 // per class. Picking for the teacher would quietly file the lesson under the wrong class, so when
 // there is more than one they choose, and only then.
 const className=id=>classes.find(c=>Number(c.id)===Number(id))?.name||'another class'
 const weekTitle=w=>w.settings?.classId?className(w.settings.classId):'No class chosen'
 const match=same.find(w=>w.id===chosenWeek)||same.find(w=>w.id===targetWeekId)||same.find(w=>w.status==='draft')||same[0]
 useEffect(()=>{if(!open||!match||picked||home?.id===match.id)return;const free=match.days.findIndex(d=>!d.off&&!d.lessonId);if(free>=0)setDay(free)},[open,match?.id])
 const dates=weekDates(weekOf)

 async function add(replace=false){
  setBusy(true);setError('')
  try{
   await beforeAdd?.()
   const d=await addLessonToWeek({lessonId:draft.savedLessonId,...(match?{weekId:match.id}:{weekOf}),day,replace,...(match?{}:newClass?{classId:Number(newClass)}:{})})
   await refresh();onAdded?.({id:d.weekId,day:d.day,weekOf:d.weekOf,ready:d.ready});onToggle?.(false)
  }catch(e){
   if(e.conflict&&window.confirm(`${WEEKDAYS[day]} already has “${e.existingTitle}”. Replace it with this lesson? The other lesson stays in My Lessons.`)){setBusy(false);return add(true)}
   // No week exists for this week and subject yet, and the teacher has more than one class, so
   // one has to be named before a week is invented for it.
   if(e.needsClass&&e.classes?.length){setClasses(e.classes);setError(e.message)}
   else setError(e.message)
  }finally{setBusy(false)}
 }
 const label=i=>{const d=match?.days?.[i];return `${WEEKDAYS[i]} ${formatDay(dates[i],{month:'short',day:'numeric'})}${d?.off?' · no lesson':d?.lessonId?(d.lessonId===draft?.savedLessonId?' · this lesson':' · taken'):''}`}
 const homeWeek=home&&weeks.find(w=>w.id===home.id)
 const ready=homeWeek?homeWeek.days.filter(d=>d.off||d.lessonId).length:0

 return <>
  {home&&!open&&<p className="atw-status">✓ In your week: <strong>{formatDay(weekDates(home.weekOf)[home.day],{weekday:'long',month:'short',day:'numeric'})}</strong> · {ready} of 5 days ready · <a href={`/lessonplan/week?id=${home.id}`}>Open my week →</a></p>}
  {open&&<div className="atw-panel" role="group" aria-label="Add to my week">
   <div className="atw-row">
    <label>Week of<input type="date" value={weekOf} disabled={busy||disabled} onChange={e=>{setWeekOf(mondayOf(e.target.value)||weekOf);setChosenWeek('')}}/></label>
    {same.length>1&&<label>Which class<select value={match?.id||''} disabled={busy||disabled} onChange={e=>setChosenWeek(e.target.value)}>{same.map(w=><option key={w.id} value={w.id}>{weekTitle(w)}{w.status!=='draft'?' · sent':''}</option>)}</select></label>}
    {!match&&classes.length>1&&<label>Which class is this week for<select value={newClass} disabled={busy||disabled} onChange={e=>setNewClass(e.target.value)}><option value="">Choose a class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><small className="atw-hint">You have no week for {weekLabel(weekOf)} yet, so this starts one. A week belongs to one class.</small></label>}
    <label>Day<select value={day} disabled={busy||disabled} onChange={e=>{setDay(Number(e.target.value));setPicked(true)}}>{WEEKDAYS.map((_,i)=><option key={i} value={i}>{label(i)}</option>)}</select></label>
   </div>
   <small>{match?`${match.days.filter(d=>d.off||d.lessonId).length} of 5 days ready in this week.`:loaded?`Starts your ${weekPhrase(weekOf)}. Add the other days whenever you’re ready.`:''}</small>
   <div className="ld-actions"><button type="button" className="ld-primary" disabled={busy||disabled||!draft?.savedLessonId} onClick={()=>add()}>{busy?'Adding…':home?`Move to ${WEEKDAYS[day]}`:`Add to ${WEEKDAYS[day]}`}</button><button type="button" className="ld-text-button" onClick={()=>onToggle?.(false)}>Cancel</button></div>
   {error&&<p role="alert" className="ld-error">{error}</p>}
  </div>}
  <style jsx>{`
  .atw-status{margin:12px 0 0;padding:10px 14px;border-radius:10px;background:var(--vic-success-soft);font-size:14px;line-height:1.5}
  .atw-status a{font-weight:700;color:var(--vic-primary)}
  .atw-panel{margin-top:12px;padding:16px;border:1px solid var(--vic-border);border-radius:12px;background:var(--vic-surface-muted)}
  .atw-row{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}
  .atw-panel label{margin:0 0 8px!important}
  @media(max-width:520px){.atw-row{grid-template-columns:1fr}}
  `}</style>
 </>
}

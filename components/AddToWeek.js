import { useEffect, useState } from 'react'
import { WEEKDAYS, defaultWeekOf, mondayOf, weekDates, formatDay, weekLabel } from '../lib/lesson-week.mjs'
import { listWeeks, addLessonToWeek } from '../lib/lesson-week-client'

// "Add to my week" for a lesson made in the detailed single-lesson planner. The week collects
// lessons one day at a time until it is ready to download or send to administration.
export default function AddToWeek({draft,beforeAdd,onAdded,disabled}){
 const placed=draft?.week
 const [weekOf,setWeekOf]=useState(placed?.weekOf||defaultWeekOf()),[day,setDay]=useState(Number.isInteger(placed?.day)?placed.day:0)
 const [weeks,setWeeks]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(null)
 useEffect(()=>{listWeeks().then(d=>setWeeks(d.weeks||[])).catch(()=>{})},[result?.weekId])
 const match=weeks.find(w=>w.weekOf===weekOf&&w.subject===draft?.input?.subject&&w.grade===draft?.input?.grade)
 const dates=weekDates(weekOf)
 useEffect(()=>{if(!match||placed)return;const open=match.days.findIndex(d=>!d.off&&!d.lessonId);if(open>=0)setDay(open)},[match?.id])

 async function add(replace=false){
  setBusy(true);setError('');setResult(null)
  try{
   await beforeAdd?.()
   const d=await addLessonToWeek({lessonId:draft.savedLessonId,weekOf,day,replace})
   setResult(d);onAdded?.({id:d.weekId,day:d.day,weekOf:d.weekOf})
  }catch(e){
   if(e.conflict&&window.confirm(`${WEEKDAYS[day]} already has “${e.existingTitle}”. Replace it with this lesson? The other lesson stays in My Lessons.`)){setBusy(false);return add(true)}
   setError(e.message)
  }finally{setBusy(false)}
 }
 const label=i=>{const d=match?.days?.[i];return `${WEEKDAYS[i]} ${formatDay(dates[i],{month:'short',day:'numeric'})}${d?.off?' · no lesson':d?.lessonId?(d.lessonId===draft?.savedLessonId?' · this lesson':' · has a lesson'):''}`}

 return <section className="ld-format atw" aria-labelledby="atw-title">
  <h3 id="atw-title">Add to my week</h3>
  <p className="ld-helper">Plan each day in detail, one at a time. VIC keeps your week together until all five days are ready, then you download it or send it to your administration.</p>
  {placed&&!result&&<p className="ld-helper">This lesson is in your {weekLabel(placed.weekOf).toLowerCase()} on {WEEKDAYS[placed.day]}. <a href={`/lessonplan/week?id=${placed.id}`}>Open my week →</a></p>}
  <div className="atw-row">
   <label>Week of<input type="date" value={weekOf} disabled={busy||disabled} onChange={e=>setWeekOf(mondayOf(e.target.value)||weekOf)}/></label>
   <label>Day<select value={day} disabled={busy||disabled} onChange={e=>setDay(Number(e.target.value))}>{WEEKDAYS.map((_,i)=><option key={i} value={i}>{label(i)}</option>)}</select></label>
  </div>
  {match&&<small>{match.days.filter(d=>d.off||d.lessonId).length} of 5 days ready in your {draft.input.grade==='K'?'Kindergarten':`Grade ${draft.input.grade}`} {draft.input.subject==='reading'?'reading':draft.input.subject} week.</small>}
  <div className="ld-actions"><button type="button" className="ld-primary" disabled={busy||disabled||!draft?.savedLessonId} onClick={()=>add()}>{busy?'Adding…':`Add to ${WEEKDAYS[day]}`}</button></div>
  {result&&<p role="status" className="ld-message">Added to {result.dayName}, {weekLabel(result.weekOf).toLowerCase()} · {result.ready} of 5 days ready. <a href={`/lessonplan/week?id=${result.weekId}`}>Open my week →</a></p>}
  {error&&<p role="alert" className="ld-error">{error}</p>}
  <style jsx>{`.atw{margin-top:18px}.atw h3{margin:0 0 6px;font-size:16px}.atw-row{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}@media(max-width:520px){.atw-row{grid-template-columns:1fr}}`}</style>
 </section>
}

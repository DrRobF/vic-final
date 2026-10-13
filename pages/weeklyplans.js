import Head from 'next/head'
import { useEffect, useState } from 'react'
import VICHeader from '../components/VICHeader'
import { supabase } from '../lib/supabase'
import { lessonOutputSections } from '../lib/lesson-designer.mjs'
import { versionLabel } from '../lib/levels.mjs'
import { WEEKDAYS, WEEK_STATUS, defaultWeekOf, mondayOf, formatDay, weekLabel, gradeLabel, subjectLabel, weekFileName } from '../lib/lesson-week.mjs'

async function api(query='',body){
 const {data:{session}}=await supabase.auth.getSession()
 if(!session)throw Object.assign(new Error('Please log in.'),{login:true})
 const r=await fetch(`/api/assistantprincipal/lessonplans${query}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${session.access_token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})
 const d=await r.json().catch(()=>({}))
 if(!r.ok)throw Object.assign(new Error(d.error||'Something went wrong. Please try again.'),{status:r.status})
 return d
}
const when=d=>d?new Date(d).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):''

export default function WeeklyPlans(){
 const [ready,setReady]=useState(false),[blocked,setBlocked]=useState(''),[schools,setSchools]=useState([]),[schoolId,setSchoolId]=useState('')
 const [weekOf,setWeekOf]=useState(''),[allRecent,setAllRecent]=useState(false),[data,setData]=useState(null)
 const [open,setOpen]=useState(null),[day,setDay]=useState(0),[comment,setComment]=useState(''),[notify,setNotify]=useState(true)
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('')

 useEffect(()=>{
  const q=new URLSearchParams(window.location.search)
  setWeekOf(mondayOf(q.get('week')||'')||defaultWeekOf())
  api().then(d=>{setSchools(d.schools);const wanted=d.schools.find(s=>s.id===q.get('school'));if(wanted||d.schools[0])setSchoolId((wanted||d.schools[0]).id);else setBlocked('none');if(q.get('plan'))openPlan(q.get('plan'),(wanted||d.schools[0])?.id)}).catch(e=>setBlocked(e.login?'login':e.message)).finally(()=>setReady(true))
 },[])
 async function load(){if(!schoolId||!weekOf)return;setError('');try{setData(await api(`?schoolId=${encodeURIComponent(schoolId)}${allRecent?'':`&week=${weekOf}`}`))}catch(e){setError(e.message)}}
 useEffect(()=>{load()},[schoolId,weekOf,allRecent])
 async function openPlan(id,school=schoolId){
  setBusy('Opening lesson plans…');setError('')
  try{const d=await api(`?schoolId=${encodeURIComponent(school)}&id=${encodeURIComponent(id)}`);setOpen(d.week);setComment(d.week.principalComment||'');setDay(Math.max(0,d.week.submission.days.findIndex(x=>!x.off)));window.history.replaceState(null,'',`/weeklyplans?school=${school}&plan=${id}`);window.scrollTo({top:0,behavior:'smooth'})}
  catch(e){setError(e.message)}finally{setBusy('')}
 }
 function closePlan(){setOpen(null);window.history.replaceState(null,'',`/weeklyplans?school=${schoolId}&week=${weekOf}`);load()}
 async function downloadPlan(){
  setBusy('Preparing the Word document…');setError('')
  try{const {data:{session}}=await supabase.auth.getSession();const r=await fetch(`/api/assistantprincipal/lessonplans?schoolId=${encodeURIComponent(schoolId)}&id=${encodeURIComponent(open.id)}&format=docx`,{headers:{Authorization:`Bearer ${session?.access_token}`}});if(!r.ok)throw new Error('Could not prepare the download.');const url=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=url;a.download=weekFileName(open).replace('Lesson-Plans',`Lesson-Plans-${open.teacherName.replace(/[^A-Za-z0-9]+/g,'-')}`);a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  catch(e){setError(e.message)}finally{setBusy('')}
 }
 async function review(e){
  e.preventDefault();setBusy('Saving your review…');setError('')
  try{const d=await api('',{action:'review',schoolId,id:open.id,comment,notify});setOpen(o=>({...o,status:'reviewed',reviewedAt:d.reviewedAt,principalComment:comment.trim()}));setNotice(`Marked reviewed.${d.emailed?` ${open.teacherName} got an email with your feedback.`:''}`)}
  catch(e){setError(e.message)}finally{setBusy('')}
 }

 const weeks=data?.weeks||[]
 const sentBy=new Set(weeks.map(w=>w.staffId))
 const missing=(data?.teachers||[]).filter(t=>!sentBy.has(t.id))
 const plan=open?.submission,current=plan?.days[day]

 return <main aria-busy={!!busy}><Head><title>Weekly Lesson Plans | Ask VIC</title><meta name="robots" content="noindex"/></Head><VICHeader currentPath="/assistantprincipal"/>
 <div className="wp-shell">
  <div className="wp-crumbs"><a href="/assistantprincipal">← School leadership workspace</a></div>
  <header className="wp-hero"><p className="wp-eyebrow">SCHOOL LEADERSHIP · LESSON PLANS</p><h1>Every teacher’s week in one place.</h1><p>Teachers build their week in AskVic and send it here. Open any week to read each day’s lesson, worksheet and answer key, leave feedback and mark it reviewed.</p></header>
  {busy&&<p className="wp-message" role="status">{busy}</p>}
  <div role="alert" className={error?'wp-message wp-error':'wp-hidden'}>{error}</div><div role="status" className={notice?'wp-message':'wp-hidden'}>{notice}</div>
  {!ready?<p role="status">Opening lesson plans…</p>:blocked?<section className="wp-panel"><h2>{blocked==='login'?'Please log in':'Lesson plans are part of the school leadership workspace'}</h2><p>{blocked==='login'?'Log in with your school leader account.':blocked==='none'?'Set up your school and staff list in the leadership workspace first.':blocked}</p><a className="wp-primary" href={blocked==='login'?'/login?next=/weeklyplans':'/assistantprincipal'}>{blocked==='login'?'Log in':'Open the leadership workspace'}</a></section>
  :open?<section className="wp-panel">
   <div className="wp-head"><div><button type="button" className="wp-text" onClick={closePlan}>← All lesson plans</button><h2>{open.teacherName}</h2><p>{weekLabel(open.weekOf)} · {gradeLabel(open.grade)} · {subjectLabel(open.subject)} · {open.state}</p><span className={`wp-badge ${open.status}`}>{WEEK_STATUS[open.status]}</span> <small>Sent {when(open.submittedAt)}{open.editedAfterSubmit?' · The teacher has edited this week since sending. You are viewing the version they sent.':''}</small></div><button type="button" className="wp-primary" onClick={downloadPlan} disabled={!!busy}>Download Word</button></div>
   <nav className="wp-days" aria-label="Days">{plan.days.map((d,i)=><button type="button" key={i} aria-pressed={day===i} onClick={()=>setDay(i)}><strong>{WEEKDAYS[i]}</strong><span>{d.off?'No lesson':d.standards.map(s=>s.code).join(', ')}</span></button>)}</nav>
   {current&&(current.off?<p className="wp-muted">No lesson planned for {formatDay(current.date)}.</p>:<article className="wp-lesson">
    <h3>{formatDay(current.date)} — {current.title}</h3>
    {lessonOutputSections(current.plan,current.input).map(s=><section key={s.key}><h4>{s.heading}</h4>{s.body.split('\n\n').map((p,n)=><p key={n}>{p}</p>)}</section>)}
    {current.worksheet&&<section className="wp-worksheet"><h4>Student worksheet — {current.worksheet.title}</h4>{current.worksheet.versions.map((v,n)=><div key={n}><h5>{versionLabel(v,n,current.input?.groups)}</h5><p>{v.directions}</p>{v.passage&&<p className="wp-passage">{v.passage}</p>}<ol>{v.questions.map((q,k)=><li key={k}><p>{q.prompt}</p><p className="wp-answer">Answer: {q.answer}</p></li>)}</ol></div>)}</section>}
   </article>)}
   <form className="wp-review" onSubmit={review}><h3>Your review</h3><label>Feedback for {open.teacherName.split(' ')[0]} (optional)<textarea rows="4" maxLength="2000" value={comment} onChange={e=>setComment(e.target.value)} placeholder="What looks strong, and anything to adjust before teaching."/></label><label className="wp-check"><input type="checkbox" checked={notify} onChange={e=>setNotify(e.target.checked)}/> Email my feedback to the teacher</label><button className="wp-primary" disabled={!!busy}>{open.status==='reviewed'?'Update review':'Mark reviewed'}</button>{open.reviewedAt&&<small>Reviewed {when(open.reviewedAt)}{open.reviewerName?` by ${open.reviewerName}`:''}</small>}</form>
  </section>
  :<>
   <section className="wp-panel wp-filters">{schools.length>1&&<label>School<select value={schoolId} onChange={e=>setSchoolId(e.target.value)}>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}<label>Week of<input type="date" value={weekOf} disabled={allRecent} onChange={e=>setWeekOf(mondayOf(e.target.value)||weekOf)}/></label><label className="wp-check"><input type="checkbox" checked={allRecent} onChange={e=>setAllRecent(e.target.checked)}/> Show all recent weeks</label></section>
   {!data?<p role="status">Loading…</p>:<>
    {!allRecent&&<p className="wp-summary"><strong>{sentBy.size} of {data.teachers.length}</strong> teachers have sent plans for the {weekLabel(weekOf).toLowerCase()}.</p>}
    <section className="wp-panel"><h2>{allRecent?'Recent lesson plans':'Sent this week'}</h2>{!weeks.length?<p className="wp-muted">No lesson plans yet{allRecent?'':' for this week'}. Teachers send them from AskVic’s weekly planner (askvic.ai/lessonplan/week).</p>:<ul className="wp-list">{weeks.map(w=><li key={w.id}><div><strong>{w.teacherName}</strong><span>{allRecent?`${weekLabel(w.weekOf)} · `:''}{gradeLabel(w.grade)} · {subjectLabel(w.subject)} · sent {when(w.submittedAt)}{w.editedAfterSubmit?' · edited since':''}</span><span className="wp-codes">{w.days.map((d,i)=><em key={i} title={WEEKDAYS[i]}>{WEEKDAYS[i].slice(0,3)}: {d.off?'—':d.codes.join(', ')}</em>)}</span></div><span className={`wp-badge ${w.status}`}>{WEEK_STATUS[w.status]}</span><button type="button" className="wp-primary" onClick={()=>openPlan(w.id)}>Open</button></li>)}</ul>}</section>
    {!allRecent&&missing.length>0&&<section className="wp-panel"><h2>Not sent yet</h2><ul className="wp-missing">{missing.map(t=><li key={t.id}>{t.name}{!t.onAskVic&&<small> · not on AskVic yet — share your school’s join code</small>}</li>)}</ul></section>}
   </>}
  </>}
 </div>
 <style jsx global>{`
 .wp-shell{max-width:1100px;margin:auto;padding:12px 24px 50px}.wp-crumbs a{font-weight:700;color:var(--vic-primary);text-decoration:none}.wp-hero{padding:24px 0 18px}.wp-eyebrow{font-size:13px;letter-spacing:.12em;font-weight:800;color:var(--vic-primary)}.wp-hero h1{font-size:clamp(30px,3.6vw,46px);letter-spacing:-.03em;margin:10px 0}.wp-hero p{color:var(--vic-text-secondary);line-height:1.6;max-width:720px}
 .wp-panel{border:1px solid var(--vic-border);background:var(--vic-surface);border-radius:16px;box-shadow:var(--vic-shadow-soft);padding:22px;margin-bottom:18px}.wp-panel h2{margin:0 0 12px;font-size:20px}.wp-filters{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-end}.wp-panel label{display:block;font-size:14px;font-weight:750}.wp-panel input:not([type=checkbox]),.wp-panel select,.wp-panel textarea{display:block;width:100%;margin-top:6px;border:1px solid var(--vic-border);border-radius:8px;padding:10px 12px;font-size:14px;font-family:inherit;background:#fff}
 .wp-check{display:flex!important;gap:8px;align-items:center;margin:12px 0}.wp-summary{font-size:16px;margin:4px 0 14px}.wp-muted{color:var(--vic-text-secondary);line-height:1.6}
 .wp-list,.wp-missing{list-style:none;padding:0;margin:0}.wp-list li{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center;padding:14px 0;border-top:1px solid var(--vic-border-soft)}.wp-list li>div span{display:block;font-size:14px;color:var(--vic-text-secondary);margin-top:3px}.wp-codes{display:flex!important;gap:6px;flex-wrap:wrap}.wp-codes em{font-style:normal;font-size:13px;background:var(--vic-surface-muted);padding:3px 7px;border-radius:6px}
 .wp-missing li{padding:8px 0;border-top:1px solid var(--vic-border-soft)}.wp-missing small{color:var(--vic-text-secondary)}
 .wp-badge{font-size:13px;font-weight:700;padding:5px 10px;border-radius:20px;background:var(--vic-primary-soft);color:var(--vic-primary);white-space:nowrap}.wp-badge.reviewed{background:var(--vic-success-soft);color:#35415E}
 .wp-primary,.wp-text{border-radius:9px;padding:10px 14px;font-weight:750;font-size:14px;cursor:pointer;font-family:inherit;text-decoration:none;display:inline-block}.wp-primary{border:1px solid var(--vic-primary);background:var(--vic-primary);color:#fff}.wp-primary:disabled{opacity:.55}.wp-text{border:0;background:transparent;color:var(--vic-primary);padding:0 0 8px}
 .wp-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap}.wp-head h2{font-size:26px;margin:4px 0}.wp-head p{margin:0 0 8px;color:var(--vic-text-secondary)}.wp-head small{color:var(--vic-text-secondary)}
 .wp-days{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:20px 0}.wp-days button{border:1px solid var(--vic-border);background:var(--vic-surface-muted);border-radius:10px;padding:10px;text-align:left;cursor:pointer;font-family:inherit}.wp-days button[aria-pressed=true]{background:var(--vic-primary);color:#fff;border-color:var(--vic-primary)}.wp-days span{display:block;font-size:13px;margin-top:3px;overflow-wrap:anywhere}
 .wp-lesson h3{font-size:22px}.wp-lesson h4{font-size:16px;margin:22px 0 8px;color:var(--vic-primary)}.wp-lesson p{white-space:pre-wrap;line-height:1.6;font-size:14px;margin:0 0 10px}.wp-passage{background:var(--vic-surface-muted);padding:12px;border-radius:8px}.wp-answer{color:#35415E}.wp-worksheet{border-top:1px solid var(--vic-border-soft);margin-top:22px}
 .wp-review{margin-top:26px;padding:18px;background:var(--vic-surface-muted);border-radius:12px}.wp-review h3{margin:0 0 8px}.wp-review small{display:block;margin-top:10px;color:var(--vic-text-secondary)}
 .wp-message{padding:12px 16px;border-radius:10px;background:var(--vic-success-soft);font-size:14px}.wp-error{background:var(--vic-danger-soft);color:#0D368F}.wp-hidden{display:none}
 @media(max-width:700px){.wp-days{grid-template-columns:repeat(2,1fr)}.wp-list li{grid-template-columns:1fr}.wp-shell{padding:10px 16px 40px}}
 `}</style></main>
}

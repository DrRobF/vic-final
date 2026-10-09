import Head from 'next/head'
import {useEffect,useState} from 'react'
import VICHeader from '../components/VICHeader'
import {supabase} from '../lib/supabase'

const TABS=[['new','New walkthrough'],['suggestions','Suggested paths'],['assigned','Assigned paths'],['history','Past walkthroughs']]
const blank={staffId:'',subject:'',visitLength:'',ratings:{},strength:'',nextStep:'',followUp:'',followUpOther:'',sharedFeedback:'',privateNotes:'',emailTeacher:true}

async function api(body,query=''){
 const {data:{session}}=await supabase.auth.getSession()
 if(!session)throw Object.assign(new Error('Please log in.'),{login:true})
 const r=await fetch(`/api/assistantprincipal/walkthroughs${query}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${session.access_token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})
 const d=await r.json().catch(()=>({}))
 if(!r.ok)throw Object.assign(new Error(d.error||'Something went wrong. Please try again.'),{status:r.status})
 return d
}
const day=d=>new Date(d).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})

export default function Walkthroughs(){
 const [ready,setReady]=useState(false),[blocked,setBlocked]=useState(''),[schools,setSchools]=useState([]),[schoolId,setSchoolId]=useState(''),[data,setData]=useState(null)
 const [tab,setTab]=useState('new'),[form,setForm]=useState(blank),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const [edits,setEdits]=useState({}),[manual,setManual]=useState({staffId:'',topic:'',note:'',dueDate:''}),[open,setOpen]=useState(null)

 useEffect(()=>{api().then(d=>{setSchools(d.schools);if(d.schools[0])setSchoolId(d.schools[0].id);else setBlocked('none')}).catch(e=>setBlocked(e.login?'login':e.status===403?e.message:e.message)).finally(()=>setReady(true))},[])
 async function load(id=schoolId){if(!id)return;try{const d=await api(null,`?schoolId=${encodeURIComponent(id)}`);setData(d)}catch(e){setError(e.message)}}
 useEffect(()=>{setData(null);load(schoolId)},[schoolId])
 useEffect(()=>{const t=new URLSearchParams(window.location.search).get('tab');if(TABS.some(([k])=>k===t))setTab(t)},[])

 async function run(label,fn){setBusy(label);setError('');setNotice('');try{await fn()}catch(e){setError(e.message)}finally{setBusy('')}}
 const set=patch=>setForm(f=>({...f,...patch}))
 const teacher=data?.staff.find(s=>s.id===form.staffId)
 const submit=e=>{e.preventDefault();run('Saving the walkthrough…',async()=>{const r=await api({action:'submit',schoolId,...form});setForm(blank);await load();setNotice(`Walkthrough saved.${r.emailed?' The teacher’s feedback email is on its way.':''}${r.emailNote?' '+r.emailNote:''}${r.suggestions?` VIC suggested ${r.suggestions} learning path${r.suggestions>1?'s':''}. Review ${r.suggestions>1?'them':'it'} in Suggested paths.`:''}`);window.scrollTo({top:0,behavior:'smooth'})})}
 const decide=(s,decision)=>run(decision==='assign'?'Assigning…':'Saving…',async()=>{await api({action:'decide',schoolId,suggestionId:s.id,decision,topic:edits[s.id]?.topic??s.topic,dueDate:edits[s.id]?.dueDate||null,note:edits[s.id]?.note||''});await load();setNotice(decision==='assign'?`Assigned to ${s.teacher}. It’s waiting in their Learning Paths.`:'Dismissed.')})
 const assignManual=e=>{e.preventDefault();run('Assigning…',async()=>{await api({action:'assign',schoolId,...manual,dueDate:manual.dueDate||null});setManual({staffId:'',topic:'',note:'',dueDate:''});await load();setNotice('Assigned. It’s waiting in their Learning Paths.')})}
 const unassign=a=>{if(!window.confirm(`Remove “${a.topic}” for ${a.teacher}?`))return;run('Removing…',async()=>{await api({action:'unassign',schoolId,assignmentId:a.id});await load()})}

 const o=data?.options
 const pending=data?.suggestions||[]
 const byTeacher=pending.reduce((m,s)=>{(m[s.teacher]=m[s.teacher]||[]).push(s);return m},{})

 return <main aria-busy={!!busy}><Head><title>Walkthroughs | Ask VIC</title><meta name="description" content="Quick classroom walkthroughs with specific feedback for teachers, and Learning Path suggestions waiting for your yes or no."/></Head><VICHeader currentPath="/assistantprincipal"/>
  <div className="crumbs"><a href="/assistantprincipal">← School leadership workspace</a></div>
  <header className="hero"><p className="eyebrow">SCHOOL LEADERSHIP · WALKTHROUGHS</p><h1>Quick visits. Specific feedback. Real growth.</h1><p>A brief walkthrough to support instructional growth, not a formal evaluation. When you save one, VIC suggests Learning Paths for that teacher. They wait here for your yes or no.</p></header>
  {!ready?<p role="status">Opening walkthroughs…</p>:blocked?<section className="card"><h2>{blocked==='login'?'Please log in':'Walkthroughs are part of the school leadership workspace'}</h2><p className="muted">{blocked==='login'?'Log in with your school leader account.':blocked==='none'?'Set up your school and staff list in the leadership workspace first. Then come back here.':blocked}</p><a className="primary" href={blocked==='login'?'/login?next=/walkthroughs':'/assistantprincipal'}>{blocked==='login'?'Log in':'Open the leadership workspace'}</a></section>:<>
   {schools.length>1&&<label className="schoolPick">School<select value={schoolId} onChange={e=>setSchoolId(e.target.value)}>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
   <nav className="tabs" aria-label="Walkthrough sections">{TABS.map(([k,l])=><button key={k} aria-pressed={tab===k} onClick={()=>{setTab(k);setNotice('');setError('')}}>{l}{k==='suggestions'&&pending.length?<b>{pending.length}</b>:null}</button>)}</nav>
   {notice&&<p className="notice" role="status">{notice}</p>}{error&&<p className="error" role="alert">{error}</p>}{busy&&<p className="working" role="status">{busy}</p>}
   {!data?<p role="status">Loading your school…</p>:<>

   {tab==='new'&&<form className="card" onSubmit={submit}>
    {!data.staff.length&&<p className="error">Your staff list is empty. Add teachers in the <a href="/assistantprincipal">leadership workspace</a> first.</p>}
    <div className="row3">
     <label>Observer<input value={data.me.name} disabled/></label>
     <label>Teacher<select required value={form.staffId} onChange={e=>set({staffId:e.target.value})}><option value="">Choose</option>{data.staff.map(s=><option key={s.id} value={s.id}>{s.name}{s.assignment?` — ${s.assignment}`:''}</option>)}</select></label>
     <label>Subject<select value={form.subject} onChange={e=>set({subject:e.target.value})}><option value="">Choose</option>{o.subjects.map(x=><option key={x}>{x}</option>)}</select></label>
    </div>
    <fieldset className="inline"><legend>Approximate visit length</legend>{o.visitLengths.map(v=><label key={v} className="pill"><input type="radio" name="len" checked={form.visitLength===v} onChange={()=>set({visitLength:v})}/>{v}</label>)}</fieldset>
    <fieldset><legend>What was observed during this visit?</legend>
     <div className="grid" role="table"><div className="gh" role="row"><span/>{o.ratings.map(r=><span key={r} role="columnheader">{r.replace(' during this visit','')}</span>)}</div>
     {o.lookFors.map(f=><div className="gr" role="row" key={f.key}><span className="lf">{f.label}</span>{o.ratings.map((r,i)=><label key={r} className="cell"><input type="radio" name={f.key} aria-label={`${f.label}: ${r}`} checked={form.ratings[f.key]===i} onChange={()=>set({ratings:{...form.ratings,[f.key]:i}})}/><span className="m">{r.replace(' during this visit','')}</span></label>)}</div>)}</div>
     <small className="muted">“Not observed” is never counted against a teacher. A short visit can’t see everything. Items marked “Emerging” become Learning Path suggestions.</small>
    </fieldset>
    <label>One specific instructional strength or positive classroom practice observed<textarea required rows="3" value={form.strength} onChange={e=>set({strength:e.target.value})}/></label>
    <label>One specific, manageable next step that could strengthen instruction or student learning<textarea required rows="3" value={form.nextStep} onChange={e=>set({nextStep:e.target.value})}/></label>
    <fieldset className="inline"><legend>Follow-up needed?</legend>{o.followUps.map(v=><label key={v} className="pill"><input type="radio" name="fu" checked={form.followUp===v} onChange={()=>set({followUp:v})}/>{v}</label>)}{form.followUp==='Other'&&<input className="other" value={form.followUpOther} maxLength="150" placeholder="Describe the follow-up" onChange={e=>set({followUpOther:e.target.value})}/>}</fieldset>
    <label>Optional additional feedback for the teacher’s email<textarea rows="3" value={form.sharedFeedback} onChange={e=>set({sharedFeedback:e.target.value})}/></label>
    <label className="private">Private administrative notes <span>Never shared with the teacher</span><textarea rows="3" value={form.privateNotes} onChange={e=>set({privateNotes:e.target.value})} placeholder="Patterns, concerns, or follow-up information. Do not include student names or identifiable student information."/></label>
    <label className="check"><input type="checkbox" checked={form.emailTeacher&&!!teacher?.hasEmail} disabled={!teacher?.hasEmail} onChange={e=>set({emailTeacher:e.target.checked})}/>Email the teacher their strength, next step, and optional feedback {teacher&&!teacher.hasEmail&&<em>(add an email for this teacher in your staff list to enable)</em>}</label>
    <p className="muted">Please do not enter student names or personally identifiable student information.</p>
    <button className="primary" disabled={!!busy||!form.staffId}>Save walkthrough</button>
   </form>}

   {tab==='suggestions'&&<section className="card"><h2>Suggested Learning Paths</h2><p className="muted">VIC suggests these from your walkthroughs. Edit the topic if you like, add an optional due date or note, then choose <strong>Assign</strong> or <strong>No thanks</strong>.</p>
    {!pending.length?<p className="muted">Nothing waiting right now. New suggestions appear after each walkthrough.</p>:Object.entries(byTeacher).map(([name,list])=><div key={name} className="teacherGroup"><h3>{name}</h3>{list.map(s=>{const e=edits[s.id]||{};const up=p=>setEdits({...edits,[s.id]:{...e,...p}});return <div key={s.id} className="sugg">
     <input aria-label="Topic" value={e.topic??s.topic} maxLength="200" onChange={x=>up({topic:x.target.value})}/>
     <small className="muted">{s.reason} · {day(s.created_at)}</small>
     <div className="suggRow"><label>Due (optional)<input type="date" value={e.dueDate||''} onChange={x=>up({dueDate:x.target.value})}/></label><label className="grow">Note to teacher (optional)<input value={e.note||''} maxLength="600" onChange={x=>up({note:x.target.value})} placeholder="e.g. Let’s talk about it at our next check-in."/></label></div>
     <div className="actions"><button className="primary" disabled={!!busy} onClick={()=>decide(s,'assign')}>Assign</button><button className="outline" disabled={!!busy} onClick={()=>decide(s,'dismiss')}>No thanks</button></div>
    </div>})}</div>)}
   </section>}

   {tab==='assigned'&&<>
    <section className="card"><h2>Assigned Learning Paths</h2><p className="muted">You see whether each teacher has finished and their reflection. Quiz scores stay private to the teacher.</p>
     {!data.assignments.length?<p className="muted">No paths assigned yet.</p>:<ul className="assignList">{data.assignments.map(a=><li key={a.id}><div className="aHead"><div><strong>{a.teacher}</strong> · {a.topic}<small className="muted">{a.source==='walkthrough'?'From a walkthrough':'Assigned directly'} · {day(a.created_at)}{a.due_date?` · Due ${new Date(a.due_date+'T12:00:00').toLocaleDateString()}`:''}</small></div><span className={`status ${a.status.replace(' ','-')}`}>{a.status==='completed'?`✓ Completed ${day(a.completedAt)}`:a.status==='started'?'Started':'Not started'}</span></div>
      {a.reflection&&<details><summary>Read reflection</summary><p className="reflection">{a.reflection}</p></details>}
      {a.status==='not started'&&<button className="textButton" onClick={()=>unassign(a)}>Remove</button>}</li>)}</ul>}
    </section>
    <form className="card" onSubmit={assignManual}><h2>Assign a path directly</h2><div className="row3">
     <label>Teacher<select required value={manual.staffId} onChange={e=>setManual({...manual,staffId:e.target.value})}><option value="">Choose</option>{data.staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
     <label className="span2">Topic<input required minLength="3" maxLength="200" value={manual.topic} onChange={e=>setManual({...manual,topic:e.target.value})} placeholder="e.g. Smooth classroom transitions"/></label></div>
     <div className="suggRow"><label>Due (optional)<input type="date" value={manual.dueDate} onChange={e=>setManual({...manual,dueDate:e.target.value})}/></label><label className="grow">Note to teacher (optional)<input value={manual.note} maxLength="600" onChange={e=>setManual({...manual,note:e.target.value})}/></label></div>
     <button className="primary" disabled={!!busy}>Assign path</button>
     <small className="muted">Teachers see assigned paths in their Learning Paths when they sign in with the email on your staff list.</small>
    </form>
   </>}

   {tab==='history'&&<section className="card"><h2>Past walkthroughs</h2>{!data.walkthroughs.length?<p className="muted">No walkthroughs yet.</p>:<ul className="history">{data.walkthroughs.map(w=><li key={w.id}><button className="rowBtn" aria-expanded={open===w.id} onClick={()=>setOpen(open===w.id?null:w.id)}><strong>{w.teacher}</strong><span>{[w.subject,day(w.created_at),w.observer_name].filter(Boolean).join(' · ')}{w.feedback_sent_at?' · ✉ feedback sent':''}</span></button>
     {open===w.id&&<div className="detail">
      <ul className="ratingsList">{o.lookFors.filter(f=>Number.isInteger(w.ratings?.[f.key])).map(f=><li key={f.key}><span>{f.label}</span><b className={`r${w.ratings[f.key]}`}>{o.ratings[w.ratings[f.key]].replace(' during this visit','')}</b></li>)}</ul>
      <p><b>Strength:</b> {w.strength}</p><p><b>Next step:</b> {w.next_step}</p>{w.follow_up&&<p><b>Follow-up:</b> {w.follow_up}</p>}{w.shared_feedback&&<p><b>Shared feedback:</b> {w.shared_feedback}</p>}{w.private_notes&&<p className="privateNote"><b>Private notes:</b> {w.private_notes}</p>}{w.visit_length&&<small className="muted">Visit length: {w.visit_length}</small>}
     </div>}</li>)}</ul>}</section>}
   </>}
  </>}
  <style jsx>{`main{max-width:1100px;margin:auto;padding:24px;color:var(--vic-text-primary)}.crumbs{margin:22px 0 4px}.crumbs a,.card a{color:var(--vic-primary);font-weight:750;font-size:13px}.hero{padding:22px 0 10px}.eyebrow{font-size:10px;font-weight:800;letter-spacing:.12em;color:var(--vic-primary);margin:0 0 12px}h1{font-size:clamp(30px,4vw,44px);line-height:1.1;letter-spacing:-.035em;margin:0 0 14px}.hero p:last-child{font-size:16px;line-height:1.7;color:var(--vic-text-secondary);max-width:760px}.card{padding:26px;background:var(--vic-surface);border:1px solid var(--vic-border);border-radius:18px;margin:16px 0}h2{font-size:23px;margin:0 0 8px}h3{font-size:16px;margin:18px 0 8px}.muted,small{font-size:13px;line-height:1.6;color:var(--vic-text-secondary)}small{display:block}.tabs{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.tabs button{padding:11px 16px;border:1px solid var(--vic-border);border-radius:10px;background:var(--vic-surface);font-weight:750;cursor:pointer;color:var(--vic-text-primary)}.tabs button[aria-pressed=true]{background:var(--vic-primary);color:white;border-color:var(--vic-primary)}.tabs b{margin-left:8px;background:#c0392b;color:white;border-radius:10px;padding:1px 7px;font-size:12px}.tabs button[aria-pressed=true] b{background:white;color:var(--vic-primary)}label{display:block;font-size:13px;font-weight:750;margin:12px 0}input:not([type=radio]):not([type=checkbox]),select,textarea{display:block;width:100%;padding:11px;border:1px solid var(--vic-border);border-radius:9px;background:white;color:var(--vic-text-primary);font:inherit;font-size:14px;margin-top:6px}textarea{resize:vertical;line-height:1.6}.row3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.span2{grid-column:span 2}fieldset{border:1px solid var(--vic-border-soft);border-radius:12px;padding:12px 16px;margin:14px 0}legend{font-weight:800;font-size:14px;padding:0 6px}.inline{display:flex;flex-wrap:wrap;gap:8px}.pill{display:flex;align-items:center;gap:6px;margin:0;padding:8px 12px;border:1px solid var(--vic-border);border-radius:20px;font-weight:600;background:white;cursor:pointer}.other{flex:1 1 260px}.grid{display:grid;gap:0}.gh,.gr{display:grid;grid-template-columns:2.4fr repeat(4,1fr);align-items:center;gap:6px}.gh span{font-size:11px;font-weight:800;text-align:center;color:var(--vic-text-secondary);padding:6px 2px}.gr{border-top:1px solid var(--vic-border-soft);padding:6px 0}.lf{font-size:14px;line-height:1.4}.cell{display:flex;justify-content:center;margin:0;cursor:pointer;padding:8px}.cell input{width:18px;height:18px}.m{display:none}.private{background:#fbf6ee;border:1px dashed #c9a46a;border-radius:12px;padding:12px}.private span{font-weight:600;color:#8a5a1a;font-size:12px;margin-left:6px}.check{display:flex;gap:10px;align-items:flex-start;font-weight:600}.check em{font-weight:500;color:var(--vic-text-secondary)}.primary,.outline{padding:12px 18px;border-radius:9px;font-weight:750;font-size:14px;cursor:pointer;text-decoration:none;display:inline-block}.primary{background:var(--vic-primary);color:white;border:1px solid var(--vic-primary)}.outline{background:white;border:1px solid var(--vic-border);color:var(--vic-text-primary)}.textButton{background:none;border:0;color:var(--vic-primary);font-weight:700;cursor:pointer;padding:6px 0}button:disabled{opacity:.5;cursor:not-allowed}.notice{padding:12px;border-radius:10px;background:var(--vic-success-soft);font-size:14px}.error{padding:12px;border-radius:10px;background:var(--vic-danger-soft);color:#7e301e;font-size:14px}.working{font-size:14px;color:var(--vic-text-secondary)}.schoolPick select{max-width:340px}.teacherGroup{border-top:1px solid var(--vic-border-soft);margin-top:8px}.sugg{border:1px solid var(--vic-border-soft);border-radius:12px;padding:14px;margin:10px 0;background:white}.sugg>input{font-weight:700}.suggRow{display:flex;gap:12px;flex-wrap:wrap}.suggRow label{margin:8px 0}.grow{flex:1 1 280px}.actions{display:flex;gap:8px;margin-top:6px}.assignList,.history,.ratingsList{list-style:none;padding:0;margin:0}.assignList li{border-top:1px solid var(--vic-border-soft);padding:12px 0}.aHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.status{font-size:12px;font-weight:800;padding:5px 10px;border-radius:14px;white-space:nowrap;background:#eee}.status.completed{background:var(--vic-success-soft)}.status.started{background:var(--vic-primary-soft)}.reflection{white-space:pre-wrap;font-size:14px;line-height:1.6;background:white;padding:12px;border-radius:10px}summary{cursor:pointer;color:var(--vic-primary);font-weight:700;font-size:13px;margin-top:6px}.rowBtn{display:flex;justify-content:space-between;gap:12px;width:100%;text-align:left;padding:14px 0;background:none;border:0;border-top:1px solid var(--vic-border-soft);cursor:pointer;font:inherit;color:var(--vic-text-primary)}.rowBtn span{font-size:13px;color:var(--vic-text-secondary)}.detail{padding:0 0 14px}.detail p{font-size:14px;line-height:1.6;margin:8px 0}.ratingsList li{display:flex;justify-content:space-between;gap:12px;font-size:13px;padding:5px 0;border-bottom:1px dotted var(--vic-border-soft)}.ratingsList b{white-space:nowrap}.r1{color:#a5531b}.r2{color:#2f6b3a}.r3{color:#1d5a2a}.privateNote{background:#fbf6ee;padding:10px;border-radius:8px}@media(max-width:760px){main{padding:16px}.row3{grid-template-columns:1fr}.span2{grid-column:auto}.gh{display:none}.gr{grid-template-columns:1fr 1fr}.lf{grid-column:1/-1;font-weight:700}.cell{justify-content:flex-start;gap:8px;border:1px solid var(--vic-border-soft);border-radius:8px}.m{display:inline;font-size:12px}.aHead{flex-direction:column}}`}</style>
 </main>
}

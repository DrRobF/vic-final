import {useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'

// Whole-class letter: one standard message for every family, built from lessons, saved lesson updates, and a note.
export default function ClassLetter(){
 const [data,setData]=useState(null),[lessonIds,setLessonIds]=useState([]),[note,setNote]=useState(''),[tasks,setTasks]=useState(null),[picked,setPicked]=useState([]),[marked,setMarked]=useState(false)
 const [letter,setLetter]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')

 async function request(body,path='/api/educator/class-letter'){
  const {data:{session}}=await supabase.auth.getSession()
  if(!session)throw new Error('Please log in to write a class letter.')
  const r=await fetch(path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${session.access_token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})
  const d=await r.json().catch(()=>({}))
  if(!r.ok)throw new Error(d.error||'Could not reach VIC. Please try again.')
  return d
 }
 useEffect(()=>{let active=true
  request().then(d=>{if(active)setData(d)}).catch(e=>{if(active)setError(e.message)})
  request(null,'/api/educator/assistant').then(d=>{if(!active)return;const list=(d.work||[]).find(w=>w.kind==='tasks')?.tasks||[];setTasks(list);setPicked(list.map((t,i)=>t.family&&!t.done?i:-1).filter(i=>i>=0))}).catch(()=>{if(active)setTasks([])})
  return()=>{active=false}},[])
 const updated=new Set((data?.familyUpdates||[]).map(u=>u.lessonId))
 const familyItems=(tasks||[]).map((t,i)=>({...t,i})).filter(t=>t.family&&!t.done)
 const reminderText=t=>t.due?`${t.title} (${new Date(t.due+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})})`:t.title
 const toggle=(list,set,id,on)=>set(on?[...list,id].slice(0,5):list.filter(x=>x!==id))

 async function write(e){
  e.preventDefault();setBusy(true);setError('');setMessage('')
  try{const d=await request({lessonIds,familyIds:lessonIds.filter(id=>updated.has(id)),note,reminders:familyItems.filter(t=>picked.includes(t.i)).map(reminderText)});setLetter(d.letter);setMarked(false);setMessage('Your class letter is ready. Review it, add your name, then copy it into your school email or messaging app.')}
  catch(err){setError(err.message)}finally{setBusy(false)}
 }
 async function markShared(){
  setBusy(true);setError('')
  try{const next=tasks.map((t,i)=>picked.includes(i)?{...t,done:true}:t);await request({action:'tasks',tasks:next},'/api/educator/assistant');setTasks(next);setPicked([]);setMarked(true);setMessage('Done. Those reminders are checked off in your task list, so they won’t show up next week.')}
  catch(err){setError(err.message)}finally{setBusy(false)}
 }
 async function copy(){try{await navigator.clipboard.writeText(`Subject: ${letter.subject}\n\n${letter.body}`);setMessage('Copied. Paste it into your school email or messaging app and send it to your class families.')}catch{setError('Copy is unavailable here. Select the text and copy it instead.')}}

 return <section className="classLetter" aria-busy={busy}>
  <form className="panel" onSubmit={write}>
   <p className="eyebrow">STEP 1 · WHAT GOES IN IT</p>
   <h2>One letter for every family.</h2>
   <p className="lead">The same letter goes to the whole class, so VIC keeps it general and never mentions individual students.</p>
   {!data&&!error&&<p role="status">Loading your lessons…</p>}
   {data&&<>
    <fieldset><legend>What we are learning (optional)</legend>
     {data.lessons.length?data.lessons.slice(0,12).map(l=><label key={l.id} className="check"><input type="checkbox" disabled={busy} checked={lessonIds.includes(l.id)} onChange={e=>toggle(lessonIds,setLessonIds,l.id,e.target.checked)}/><span>{l.title}{updated.has(l.id)&&<em> · includes your saved family update</em>}</span></label>):<p className="empty">No saved lessons yet. Lessons you build in the Lesson Designer show up here.</p>}
    </fieldset>
   </>}
   <fieldset><legend>Saved for families this week</legend>
    {tasks===null?<p className="empty">Loading your reminders…</p>:familyItems.length?familyItems.map(t=><label key={t.i} className="check"><input type="checkbox" disabled={busy} checked={picked.includes(t.i)} onChange={e=>setPicked(e.target.checked?[...picked,t.i]:picked.filter(x=>x!==t.i))}/><span>{t.title}{t.due&&<em> · {reminderText({title:'',due:t.due}).replace(/^ \(|\)$/g,'')}</em>}</span></label>):<p className="empty">Nothing saved yet. In your <a href="/educatorassistant?tool=tasks">assistant’s task list</a>, mark a to-do <strong>For families</strong> (a due date, an event, “read with your child”) and it shows up here, ready to click.</p>}
   </fieldset>
   <label htmlFor="class-note" className="noteLabel">Your note to all families (optional)</label>
   <textarea id="class-note" rows="5" maxLength="3000" disabled={busy} value={note} onChange={e=>setNote(e.target.value)} placeholder="Reminders, upcoming dates, a celebration, or anything you want every family to know. Quick notes are fine."/>
   <button className="primary" disabled={busy||(!lessonIds.length&&!picked.length&&note.trim().length<10)}>{busy?'VIC is writing…':letter?'Write a fresh letter':'Write the class letter'}</button>
  </form>
  <section className="panel">
   <p className="eyebrow">STEP 2 · REVIEW AND SEND</p>
   <h2>Make it yours.</h2>
   {message&&<p className="message" role="status">{message}</p>}{error&&<p className="error" role="alert">{error}</p>}
   {letter?<>
    <label htmlFor="class-subject">Subject</label>
    <input id="class-subject" value={letter.subject} maxLength="240" onChange={e=>setLetter({...letter,subject:e.target.value})}/>
    <label htmlFor="class-body">Letter to all families</label>
    <textarea id="class-body" rows="16" value={letter.body} maxLength="12000" onChange={e=>setLetter({...letter,body:e.target.value})}/>
    <div className="actions"><button className="primary" type="button" onClick={copy}>Copy letter</button>{picked.length>0&&!marked&&<button className="outline" type="button" disabled={busy} onClick={markShared}>Mark these reminders as shared</button>}</div>
    <small>Nothing is sent automatically. This letter stays here while the page is open, so copy it before you leave.</small>
   </>:<p className="empty">Your letter will appear here.</p>}
  </section>
  <style jsx>{`.classLetter{display:grid;grid-template-columns:1fr 1fr;gap:22px;align-items:start}.panel{padding:28px;background:var(--vic-surface);border:1px solid var(--vic-border);border-radius:18px}.eyebrow{font-size:10px;font-weight:800;letter-spacing:.12em;color:var(--vic-primary);margin:0 0 12px}h2{font-size:26px;line-height:1.2;letter-spacing:-.025em;margin:0 0 10px}.lead,.empty,small{font-size:13px;line-height:1.6;color:var(--vic-text-secondary)}small{display:block;margin-top:12px}fieldset{border:1px solid var(--vic-border-soft);border-radius:12px;padding:12px 14px;margin:14px 0}legend{font-size:13px;font-weight:750;padding:0 6px}.check{display:flex;gap:8px;align-items:flex-start;font-size:13px;line-height:1.45;padding:6px 0}.check input{margin-top:3px}.noteLabel,label[for]{display:block;font-size:13px;font-weight:750;margin-top:10px}textarea,input:not([type=checkbox]){display:block;width:100%;padding:12px;border:1px solid var(--vic-border);border-radius:9px;background:white;color:var(--vic-text-primary);font:inherit;font-size:14px;line-height:1.6;margin:8px 0 14px}textarea{resize:vertical}.actions{display:flex;gap:8px;flex-wrap:wrap}.outline{padding:12px 17px;border-radius:9px;font-size:13px;font-weight:750;cursor:pointer;background:var(--vic-surface);color:var(--vic-text-primary);border:1px solid var(--vic-border)}.check em{font-style:normal;color:var(--vic-text-secondary);font-size:12px}.empty a{color:var(--vic-primary)}.primary{padding:12px 17px;border-radius:9px;font-size:13px;font-weight:750;cursor:pointer;background:var(--vic-primary);color:white;border:1px solid var(--vic-primary)}button:disabled{opacity:.5;cursor:not-allowed}.message,.error{padding:12px;border-radius:10px;font-size:13px;line-height:1.6}.message{background:var(--vic-success-soft)}.error{background:var(--vic-danger-soft);color:#7e301e}@media(max-width:850px){.classLetter{grid-template-columns:1fr}}`}</style>
 </section>
}

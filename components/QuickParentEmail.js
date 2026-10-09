import {useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'
import {ASSISTANT_TOOLS} from '../lib/educator-assistant.mjs'

// Quick email from notes: the teacher jots notes, VIC writes a complete parent email.
// Uses the educator assistant API (kind "parent_email"), so it works for any educator, with or without a roster.
const TOOL=ASSISTANT_TOOLS.parent_email

export default function QuickParentEmail(){
 const [notes,setNotes]=useState(''),[draft,setDraft]=useState(''),[dirty,setDirty]=useState(false)
 const [busy,setBusy]=useState(false),[ready,setReady]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')

 async function request(body){
  const {data:{session}}=await supabase.auth.getSession()
  if(!session)throw new Error('Please log in to write a parent email.')
  const r=await fetch('/api/educator/assistant',{method:body?'POST':'GET',headers:{Authorization:`Bearer ${session.access_token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})
  const d=await r.json().catch(()=>({}))
  if(!r.ok)throw new Error(d.error||'Could not reach VIC. Please try again.')
  return d
 }

 useEffect(()=>{let active=true;request().then(d=>{const saved=(d.work||[]).find(w=>w.kind==='parent_email');if(active&&saved){setNotes(saved.notes||'');setDraft(saved.draft||'')}}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setReady(true)});return()=>{active=false}},[])

 async function run(action){
  setBusy(true);setError('');setMessage('')
  try{
   const d=await request({action,kind:'parent_email',notes,draft})
   setNotes(d.work.notes||notes);setDraft(d.work.draft||'');setDirty(false)
   setMessage(d.unsaved?'Your email is ready. Copy it before you leave this page.':action==='generate'?'Your email is ready and saved privately. Add the name, review it, then send it from your school email.':'Your edits are saved.')
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function copy(){try{await navigator.clipboard.writeText(draft);setMessage('Copied. Paste it into your school email, add the name, and send.')}catch{setError('Copy is unavailable here. Select the text and copy it instead.')}}

 return <section className="quick" aria-busy={busy}>
  <form className="panel" onSubmit={e=>{e.preventDefault();run('generate')}}>
   <p className="eyebrow">STEP 1 · YOUR NOTES</p>
   <h2>{TOOL.title}</h2>
   <label htmlFor="quick-notes">Quick notes about the student and what you want to say</label>
   <textarea id="quick-notes" rows="11" disabled={busy||!ready} value={notes} onChange={e=>{setNotes(e.target.value);setDirty(true)}} required minLength="10" maxLength="5000" placeholder={TOOL.placeholder}/>
   <button className="primary" disabled={busy||!ready||notes.trim().length<10}>{busy?'VIC is writing…':draft?'Write a fresh email':'Write my email'}</button>
   <p className="help">Fragments are fine. Leave out the student’s name; VIC uses [Student] so you can add it before you send.</p>
  </form>
  <section className="panel">
   <p className="eyebrow">STEP 2 · REVIEW AND SEND</p>
   <h2>Make it yours.</h2>
   {message&&<p className="message" role="status">{message}</p>}{error&&<p className="error" role="alert">{error}</p>}
   <label htmlFor="quick-draft">Your editable email</label>
   <textarea id="quick-draft" rows="16" disabled={busy} value={draft} onChange={e=>{setDraft(e.target.value);setDirty(true)}} maxLength="16000" placeholder="Your email will appear here."/>
   <div className="actions">
    <button className="primary" type="button" disabled={!draft||busy} onClick={copy}>Copy email</button>
    <button className="outline" type="button" disabled={busy||!dirty||notes.trim().length<10||!draft} onClick={()=>run('save')}>Save my edits</button>
   </div>
   <small>Nothing is sent automatically. For a letter that includes VIC reports, lesson goals, or suggested comments, use <a href="/parentletters?mode=student">One student letter</a>.</small>
  </section>
  <style jsx>{`.quick{display:grid;grid-template-columns:1fr 1fr;gap:22px;align-items:start}.panel{padding:28px;background:var(--vic-surface);border:1px solid var(--vic-border);border-radius:18px}.eyebrow{font-size:10px;font-weight:800;letter-spacing:.12em;color:var(--vic-primary);margin:0 0 12px}h2{font-size:26px;line-height:1.2;letter-spacing:-.025em;margin:0 0 16px}label{display:block;font-size:13px;font-weight:750;margin:12px 0 0}textarea{display:block;width:100%;padding:12px;border:1px solid var(--vic-border);border-radius:9px;background:white;color:var(--vic-text-primary);font:inherit;font-size:14px;line-height:1.65;margin:8px 0 14px;resize:vertical}.primary,.outline{padding:12px 17px;border-radius:9px;font-size:13px;font-weight:750;cursor:pointer}.primary{background:var(--vic-primary);color:white;border:1px solid var(--vic-primary)}.outline{background:var(--vic-surface);color:var(--vic-text-primary);border:1px solid var(--vic-border)}button:disabled{opacity:.5;cursor:not-allowed}.actions{display:flex;gap:8px;flex-wrap:wrap}.help,small{display:block;font-size:12px;line-height:1.6;color:var(--vic-text-secondary);margin-top:12px}small a{color:var(--vic-primary)}.message,.error{padding:12px;border-radius:10px;font-size:13px;line-height:1.6}.message{background:var(--vic-success-soft)}.error{background:var(--vic-danger-soft);color:#7e301e}@media(max-width:850px){.quick{grid-template-columns:1fr}}`}</style>
 </section>
}

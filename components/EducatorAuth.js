import {useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'
import {completeLessonAccess,finishLessonCode} from '../lib/lesson-signin-client.mjs'
import {LESSON_CONSENT_TEXT} from '../lib/lesson-access.mjs'

export default function EducatorAuth({mode='signup'}){
 const signup=mode==='signup'
 const [email,setEmail]=useState(''),[code,setCode]=useState(''),[adult,setAdult]=useState(false),[consent,setConsent]=useState(false)
 const [session,setSession]=useState(null),[ready,setReady]=useState(false),[checking,setChecking]=useState(false),[busy,setBusy]=useState(false)
 const [sent,setSent]=useState(false),[error,setError]=useState(''),[finishConsent,setFinishConsent]=useState(false),[enabled,setEnabled]=useState(null)
 useEffect(()=>{
  let active=true
  fetch('/api/lessonplan/access').then(r=>r.json()).then(d=>{if(active)setEnabled(d.signupEnabled===true)}).catch(()=>{if(active)setEnabled(false)})
  if(/token_hash=|access_token=|error_description=/.test(window.location.hash)){window.location.replace('/lessonplan/confirm'+window.location.hash);return}
  supabase.auth.getSession().then(({data})=>{if(active){setSession(data.session);setReady(true)}}).catch(()=>{if(active){setReady(true);setError('Could not restore your login. Please request a new email.')}})
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{if(active){setSession(next);setReady(true)}})
  return()=>{active=false;subscription.unsubscribe()}
 },[])
 useEffect(()=>{
  if(!session||busy)return
  let active=true;setChecking(true)
  // Runs outside the auth callback so it cannot hold Supabase's session lock.
  completeLessonAccess(fetch,session).then(()=>{if(active)window.location.replace('/lessonplan')}).catch(e=>{if(active){if(e.needsConsent)setFinishConsent(true);else setError(e.message)}}).finally(()=>{if(active)setChecking(false)})
  return()=>{active=false}
 },[session?.access_token,busy])
 async function requestEmail(e){
  e.preventDefault();setBusy(true);setError('')
  try{
   const r=await fetch('/api/lessonplan/email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,intent:mode,...(signup?{adultEducator:adult,consent}:{})})})
   const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not send your email. Please try again.')
   setSent(true)
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function verifyCode(e){
  e.preventDefault();setBusy(true);setError('')
  try{await finishLessonCode(supabase,fetch,email,code.trim());window.location.replace('/lessonplan')}
  catch(e){setError(e.message);if(e.needsConsent)setFinishConsent(true)}finally{setBusy(false)}
 }
 async function finishSignup(e){
  e.preventDefault();setBusy(true);setError('')
  try{
   const {data}=await supabase.auth.getSession()
   const r=await fetch('/api/lessonplan/access',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session?.access_token}`},body:JSON.stringify({adultEducator:adult,consent})})
   const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not finish signup.')
   window.location.replace('/lessonplan')
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 const checks=<><label className="check" style={{display:"flex",alignItems:"flex-start",gap:12,margin:"18px 0",fontSize:14,fontWeight:400,lineHeight:1.6}}><input type="checkbox" style={{marginTop:5,flexShrink:0}} required checked={adult} onChange={e=>setAdult(e.target.checked)}/>I am an adult educator using this tool for lesson preparation.</label><label className="check" style={{display:"flex",alignItems:"flex-start",gap:12,margin:"18px 0",fontSize:14,fontWeight:400,lineHeight:1.6}}><input type="checkbox" style={{marginTop:5,flexShrink:0}} required checked={consent} onChange={e=>setConsent(e.target.checked)}/>{LESSON_CONSENT_TEXT}</label></>
 return <section className="auth-card" aria-label={signup?'Free educator signup':'Educator login'}>
  {!ready||checking?<p role="status">Checking your account and opening Lesson Designer…</p>:finishConsent&&session?<>
   <h2>One last step for your account</h2><p>Your email <strong>{session.user.email}</strong> is verified. Confirm these choices once to finish your free signup. You do not need another email.</p>
   <form onSubmit={finishSignup}>{checks}<button className="primary" disabled={busy}>{busy?'Opening Lesson Designer…':'Finish signup & open Lesson Designer'}</button></form>
  </>:sent?<>
   <h2>Check your email</h2><p>{signup?'We sent a verification email to':'If this email has an educator account, we sent a login email to'} <strong>{email}</strong>.</p>
   <p><strong>Click the email link to open Lesson Designer.</strong> If it opens in another browser, enter the code here instead.</p>
   <form onSubmit={verifyCode}><label>Verification code<input required inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} minLength={6} maxLength={10}/></label><button className="primary" disabled={busy}>{busy?'Opening Lesson Designer…':'Verify code & open Lesson Designer'}</button></form>
   <p className="small">Use your newest email. The link and code are one-time use; once you use either, the other stops working.</p>
   <button className="text-button" disabled={busy} onClick={()=>{setSent(false);setCode('');setError('')}}>Change email or request a new email</button>
   {!signup&&<p className="small">New here? <a href="/signup">Create your free account</a> first.</p>}
  </>:<>
   <h2>{signup?'Create your free educator account':'Log in to Lesson Designer'}</h2>
   <p>{signup?'Use your email to create new lessons, refresh older ones, and edit before downloading. No password or trial countdown.':'Enter the email you signed up with. We’ll send a login link and code. No password and no signup checkboxes.'}</p>
   {enabled===false?<p role="alert">Email access is temporarily unavailable. Please try again shortly.</p>:<form onSubmit={requestEmail}><label>Email address<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>{signup&&checks}<button className="primary" disabled={busy||enabled!==true}>{busy?'Sending your email…':signup?'Sign up — it’s free':'Email my login link'}</button></form>}
   <p className="small">{signup?<>Already have an account? <a href="/login">Log in</a>.</>:<>Need an account? <a href="/signup">Sign up — it’s free</a>.</>}</p>
   {signup&&<p className="small">Currently free. Paid options may be introduced later. Fair-use protections apply. Educator signup does not provide access to school accounts or student data. <a href="/lessonplan/privacy">Privacy &amp; email preferences</a>.</p>}
  </>}
  {error&&<p className="error" role="alert">{error}</p>}
  <style jsx>{`.auth-card{background:var(--vic-surface);border:1px solid var(--vic-border);border-radius:18px;padding:32px;box-shadow:var(--vic-shadow-card)}h2{margin:0 0 14px;font-size:28px;line-height:1.2}p{line-height:1.6}label{display:block;margin:18px 0;font-weight:700}input:not([type=checkbox]){display:block;width:100%;margin-top:8px;padding:13px;border:1px solid var(--vic-border);border-radius:9px;background:var(--vic-surface);color:var(--vic-text-primary)}.check{display:flex;align-items:flex-start;gap:12px;font-size:14px;font-weight:400;line-height:1.6}.check input{margin-top:5px;flex-shrink:0}.primary{width:100%;padding:14px 18px;border:0;border-radius:10px;background:var(--vic-primary);color:white;font-weight:800;cursor:pointer}.primary:disabled{opacity:.65;cursor:wait}.small{font-size:13px;color:var(--vic-text-secondary)}.text-button{background:none;border:0;padding:0;color:var(--vic-primary);text-decoration:underline;cursor:pointer}.error{color:var(--vic-danger);font-weight:700}@media(max-width:600px){.auth-card{padding:22px}h2{font-size:24px}}`}</style>
 </section>
}

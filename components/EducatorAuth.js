import {useEffect,useState} from 'react'
import {useRouter} from 'next/router'
import {educatorDestination} from '../lib/educator-account.mjs'
import {supabase} from '../lib/supabase'
import {completeLessonAccess,finishLessonCode} from '../lib/lesson-signin-client.mjs'

export default function EducatorAuth({mode='signup'}){
 const router=useRouter(),signup=mode==='signup'
 const destination=educatorDestination(router.query.next)
 const [email,setEmail]=useState(''),[code,setCode]=useState(''),[adult,setAdult]=useState(false),[consent,setConsent]=useState(false),[updates,setUpdates]=useState(null)
 const [session,setSession]=useState(null),[ready,setReady]=useState(false),[checking,setChecking]=useState(false),[busy,setBusy]=useState(false)
 const [sent,setSent]=useState(false),[error,setError]=useState(''),[finishConsent,setFinishConsent]=useState(false),[enabled,setEnabled]=useState(null)
 useEffect(()=>{
  if(!router.isReady)return
  let active=true
  fetch('/api/lessonplan/access').then(r=>r.json()).then(d=>{if(active)setEnabled(d.signupEnabled===true)}).catch(()=>{if(active)setEnabled(false)})
  if(/token_hash=|access_token=|error_description=/.test(window.location.hash)){window.location.replace('/lessonplan/confirm?next='+encodeURIComponent(destination)+window.location.hash);return}
  supabase.auth.getSession().then(({data})=>{if(active){setSession(data.session);setReady(true)}}).catch(()=>{if(active){setReady(true);setError('Could not restore your login. Please request a new email.')}})
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{if(active){setSession(next);setReady(true)}})
  return()=>{active=false;subscription.unsubscribe()}
 },[router.isReady])
 useEffect(()=>{
  if(!session||busy||!router.isReady)return
  let active=true;setChecking(true)
  // Runs outside the auth callback so it cannot hold Supabase's session lock.
  completeLessonAccess(fetch,session).then(()=>{if(active)window.location.replace(destination)}).catch(e=>{if(active){if(e.needsConsent)setFinishConsent(true);else setError(e.message)}}).finally(()=>{if(active)setChecking(false)})
  return()=>{active=false}
 },[session?.access_token,busy,router.isReady,destination])
 async function requestEmail(e){
  e.preventDefault();setBusy(true);setError('')
  try{
   const r=await fetch('/api/lessonplan/email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,intent:mode,next:destination,...(signup?{adultEducator:adult,consent,updates}:{})})})
   const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not send your email. Please try again.')
   setSent(true)
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function verifyCode(e){
  e.preventDefault();setBusy(true);setError('')
  try{await finishLessonCode(supabase,fetch,email,code.trim());window.location.replace(destination)}
  catch(e){setError(e.message);if(e.needsConsent)setFinishConsent(true)}finally{setBusy(false)}
 }
 async function finishSignup(e){
  e.preventDefault();setBusy(true);setError('')
  try{
   const {data}=await supabase.auth.getSession()
   const r=await fetch('/api/lessonplan/access',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session?.access_token}`},body:JSON.stringify({adultEducator:adult,consent,updates})})
   const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not finish signup.')
   window.location.replace(destination)
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 const checks=<>
  <fieldset className="updatesChoice" style={{border:'2px solid var(--vic-primary)',borderRadius:14,padding:'16px 18px',margin:'20px 0',background:'var(--vic-primary-soft, #f6efe6)'}}>
   <legend style={{fontWeight:800,fontSize:16,padding:'0 6px'}}>Would you like email updates from Dr. Rob Furman?</legend>
   <p style={{margin:'4px 0 12px',fontSize:14,lineHeight:1.6}}>Occasional teaching tips, new Ask VIC features, and workshop news. <strong>Please choose one.</strong> Saying no never limits your access to Ask VIC, and you can change your mind anytime.</p>
   <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
    {[[true,'Yes, send me updates'],[false,'No thanks']].map(([value,label])=><label key={label} style={{display:'flex',alignItems:'center',gap:10,padding:'14px 16px',border:`2px solid ${updates===value?'var(--vic-primary)':'var(--vic-border, #ddd)'}`,borderRadius:12,background:updates===value?'white':'rgba(255,255,255,.6)',fontWeight:750,fontSize:15,cursor:'pointer'}}><input type="radio" name="vic-updates" required checked={updates===value} onChange={()=>setUpdates(value)} style={{width:20,height:20}}/>{label}</label>)}
   </div>
  </fieldset>
  <label className="check" style={{display:"flex",alignItems:"flex-start",gap:12,margin:"14px 0",fontSize:14,fontWeight:400,lineHeight:1.6}}><input type="checkbox" style={{marginTop:5,flexShrink:0}} required checked={adult} onChange={e=>setAdult(e.target.checked)}/>I am an adult educator (18 or older) using Ask VIC for my professional work.</label>
  <label className="check" style={{display:"flex",alignItems:"flex-start",gap:12,margin:"14px 0",fontSize:14,fontWeight:400,lineHeight:1.6}}><input type="checkbox" style={{marginTop:5,flexShrink:0}} required checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>I agree to the <a href="/terms" target="_blank" rel="noopener">Terms of Use</a> and <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>.</span></label>
 </>
 return <section className="auth-card" aria-label={signup?'Free educator signup':'Educator login'}>
  {!ready||checking?<p role="status">Checking your educator account…</p>:finishConsent&&session?<>
   <h2>One last step for your account</h2><p>Your email <strong>{session.user.email}</strong> is verified. Confirm these choices once to finish your free signup. You do not need another email.</p>
   <form onSubmit={finishSignup}>{checks}<button className="primary" disabled={busy}>{busy?'Opening your workspace…':'Finish signup & open workspace'}</button></form>
  </>:sent?<>
   <h2>Check your email</h2><p>{signup?'We sent a verification email to':'If this email has an educator account, we sent a login email to'} <strong>{email}</strong>.</p>
   <p><strong>Open the email link and keep working in that browser.</strong> Or stay in this browser and enter the code below instead of opening the link.</p>
   <form onSubmit={verifyCode}><label>Verification code<input required inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} minLength={6} maxLength={10}/></label><button className="primary" disabled={busy}>{busy?'Opening your workspace…':'Verify code & open workspace'}</button></form>
   <p className="small">Use your newest email. The link and code are one-time use; once you use either, the other stops working.</p>
   <button className="text-button" disabled={busy} onClick={()=>{setSent(false);setCode('');setError('')}}>Change email or request a new email</button>
   {!signup&&<p className="small">New here? <a href="/signup">Create your free account</a> first.</p>}
  </>:<>
   <h2>{signup?'Create your free educator account':'Log in to your educator account'}</h2>
   <p>{signup?'Use your email to create new lessons, refresh older ones, and edit before downloading. No password or trial countdown.':'Use your school teacher email or the email you signed up with. We’ll send one login link and code for your educator tools.'}</p>
   {enabled===false?<p role="alert">Email access is temporarily unavailable. Please try again shortly.</p>:<form onSubmit={requestEmail}><label>Email address<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>{signup&&checks}<button className="primary" disabled={busy||enabled!==true}>{busy?'Sending your email…':signup?'Sign up — it’s free':'Email my login link'}</button></form>}
   <p className="small">{signup?<>Already have an account? <a href="/login">Log in</a>.</>:<>Need an account? <a href="/signup">Sign up — it’s free</a>.</>}</p>
   {signup&&<p className="small">Currently free. Paid options may be introduced later. Fair-use protections apply. Educator signup does not provide access to school accounts or student data. <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Use</a> · <a href="/lessonplan/preferences">Email preferences</a>.</p>}
  </>}
  {error&&<p className="error" role="alert">{error}</p>}
  <style jsx>{`.auth-card{background:var(--vic-surface);border:1px solid var(--vic-border);border-radius:18px;padding:32px;box-shadow:var(--vic-shadow-card)}h2{margin:0 0 14px;font-size:28px;line-height:1.2}p{line-height:1.6}label{display:block;margin:18px 0;font-weight:700}input:not([type=checkbox]){display:block;width:100%;margin-top:8px;padding:13px;border:1px solid var(--vic-border);border-radius:9px;background:var(--vic-surface);color:var(--vic-text-primary)}.check{display:flex;align-items:flex-start;gap:12px;font-size:14px;font-weight:400;line-height:1.6}.check input{margin-top:5px;flex-shrink:0}.primary{width:100%;padding:14px 18px;border:0;border-radius:10px;background:var(--vic-primary);color:white;font-weight:800;cursor:pointer}.primary:disabled{opacity:.65;cursor:wait}.small{font-size:13px;color:var(--vic-text-secondary)}.text-button{background:none;border:0;padding:0;color:var(--vic-primary);text-decoration:underline;cursor:pointer}.error{color:var(--vic-danger);font-weight:700}@media(max-width:600px){.auth-card{padding:22px}h2{font-size:24px}}`}</style>
 </section>
}

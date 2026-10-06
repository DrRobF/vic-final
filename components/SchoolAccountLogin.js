import {useState} from 'react'
import {useRouter} from 'next/router'
import {supabase} from '../lib/supabase'
import {requiresPasswordChange} from '../lib/password-policy.mjs'
import {educatorDestination,schoolEducator,studentProfile} from '../lib/educator-account.mjs'
export default function SchoolAccountLogin({student=false}){
 const router=useRouter(),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 async function submit(e){
  e.preventDefault();setBusy(true);setError('')
  try{
   const login=email.trim().toLowerCase(),normalized=login.includes('@')?login:`${login}@students.askvic.ai`
   const {data,error}=await supabase.auth.signInWithPassword({email:normalized,password})
   if(error)throw new Error(error.message||'Could not log in.')
   if(requiresPasswordChange(data.user)){await router.replace('/change-password');return}
   const result=await supabase.from('users').select('role').eq('auth_user_id',data.user.id).order('id',{ascending:true}).limit(1)
   if(result.error)throw new Error('Could not check your school account. Please try again.')
   const profile=result.data?.[0]
   if(studentProfile(profile)){await router.replace('/askvic');return}
   if(schoolEducator(profile)){await router.replace(educatorDestination(router.query.next));return}
   throw new Error('No approved school profile was found. Please contact your school administrator.')
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 return <form onSubmit={submit}><p>{student?'Use the username and password your school gave you.':'Use your existing school email and password. This signs you into both VIC and Lesson Designer.'}</p><label htmlFor="school-email">{student?'Student username or email':'School email'}<input id="school-email" type={student?'text':'email'} required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}/></label><label htmlFor="school-password">Password<input id="school-password" type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy}>{busy?'Logging in…':student?'Student log in':'Educator log in'}</button>{error&&<p role="alert" className="error">{error}</p>}<style jsx>{`form{display:grid;gap:14px}p{line-height:1.6;color:var(--vic-text-secondary)}label{display:grid;gap:8px;font-weight:700}input{width:100%;padding:13px;border:1px solid var(--vic-border);border-radius:9px;background:var(--vic-surface)}button{padding:14px;border:0;border-radius:10px;background:var(--vic-primary);color:white;font-weight:800;cursor:pointer}.error{color:var(--vic-danger)}button:disabled{opacity:.6}`}</style></form>
}

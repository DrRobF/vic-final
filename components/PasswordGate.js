import {useEffect,useState} from 'react'
import {useRouter} from 'next/router'
import {supabase} from '../lib/supabase'
import {requiresPasswordChange} from '../lib/password-policy.mjs'

const ACCOUNT_ROUTES=new Set(['/login','/student-login','/signup','/lessonplan/access','/lessonplan/confirm','/change-password'])
// Public marketing pages render immediately (including the server-rendered HTML that search
// engines and link previews read). The account check still runs in the background so a
// signed-in user who must change their password is redirected.
const PUBLIC_ROUTES=new Set(['/','/privacy','/terms'])
export default function PasswordGate({children}){
 const router=useRouter(),accountPage=ACCOUNT_ROUTES.has(router.pathname),publicPage=PUBLIC_ROUTES.has(router.pathname)
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0)
 useEffect(()=>{
  if(accountPage){setReady(true);setError('');return}
  let active=true,timer
  async function check(){
   try{
    const {data:{session},error:sessionError}=await supabase.auth.getSession()
    if(!active)return
    if(sessionError)throw sessionError
    if(requiresPasswordChange(session?.user)){setReady(false);await router.replace('/change-password')}
    else{setReady(true);setError('')}
   }catch{if(active)setError('Could not check your login. Please try again.')}
  }
  setReady(false);setError('');check()
  const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{
   clearTimeout(timer);timer=setTimeout(()=>check(),0)
  })
  return()=>{active=false;clearTimeout(timer);subscription.unsubscribe()}
 },[router.pathname,accountPage,retry])
 // The verification page must stay mounted while the session is being created.
 // Do not sign users out because a background account check temporarily fails.
 if(accountPage||publicPage||ready)return children
 return <div style={{padding:32}}>{error?<><p role="alert">{error}</p><button onClick={()=>setRetry(n=>n+1)}>Try again</button> <a href="/login">Log in</a></>:<p role="status">Checking account access…</p>}</div>
}

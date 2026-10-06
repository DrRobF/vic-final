import {useEffect,useRef,useState} from 'react'
import Head from 'next/head'
import {educatorDestination} from '../../lib/educator-account.mjs'
import {supabase} from '../../lib/supabase'
import {finishLessonSignin} from '../../lib/lesson-signin-client.mjs'
export default function ConfirmLessonSignin(){
 const started=useRef(false),[error,setError]=useState('')
 useEffect(()=>{
  if(started.current)return;started.current=true
  const fragment=window.location.hash
  const destination=educatorDestination(new URLSearchParams(window.location.search).get('next'))
  // Remove the one-time credential from browser history before exchanging it.
  window.history.replaceState(null,'','/lessonplan/confirm')
  finishLessonSignin(supabase,fetch,fragment).then(()=>window.location.replace(destination)).catch(e=>{
   if(e.needsConsent){window.location.replace('/signup?finish=1&next='+encodeURIComponent(destination));return}
   setError(e.message)
  })
 },[])
 return <><Head><title>Opening your educator workspace | Ask VIC</title><meta name="referrer" content="no-referrer"/></Head><main style={{maxWidth:650,margin:'12vh auto',padding:32,textAlign:'center'}}><h1>{error?'Your login needs attention':'Opening your educator workspace…'}</h1>{error?<><p role="alert">{error}</p><p><a href="/login">Request a new login email</a></p><p>If you already used this link, <a href="/lessonplan">open Lesson Designer in that browser</a>.</p></>:<p role="status">Verifying your email and opening your educator workspace. Please keep this page open.</p>}</main></>
}

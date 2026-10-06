import {useEffect,useRef,useState} from 'react'
import Head from 'next/head'
import {supabase} from '../../lib/supabase'
import {finishLessonSignin} from '../../lib/lesson-signin-client.mjs'
export default function ConfirmLessonSignin(){
 const started=useRef(false),[error,setError]=useState('')
 useEffect(()=>{if(started.current)return;started.current=true;finishLessonSignin(supabase,fetch,window.location.hash).then(()=>window.location.replace('/lessonplan')).catch(e=>{window.history.replaceState(null,'','/lessonplan/confirm');setError(e.message)})},[])
 return <><Head><title>Opening Lesson Designer | Ask VIC</title><meta name="referrer" content="no-referrer"/></Head><main style={{maxWidth:650,margin:'12vh auto',padding:32,textAlign:'center'}}><h1>{error?'Let’s finish your access':'Opening Lesson Designer…'}</h1>{error?<><p role="alert">{error}</p><a href="/lessonplan/access">Sign in or finish signup</a></>:<p role="status">Verifying your email and completing your free signup. You’ll go straight to your lesson workspace.</p>}</main></>
}

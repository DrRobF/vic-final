import {useEffect} from 'react'
import Head from 'next/head'
export default function LegacyLessonAccess(){
 useEffect(()=>{window.location.replace(/token_hash=|access_token=|error_description=/.test(window.location.hash)?'/lessonplan/confirm'+window.location.hash:'/signup')},[])
 return <><Head><title>Opening your account | Ask VIC</title></Head><p style={{padding:32}} role="status">Opening your account page…</p></>
}

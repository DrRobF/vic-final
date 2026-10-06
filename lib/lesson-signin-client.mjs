export async function completeLessonAccess(fetcher,session){
 if(!session?.access_token)throw new Error('Could not finish login. Please request a fresh email.')
 const response=await fetcher('/api/lessonplan/access',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({completeFromEmail:true})})
 const result=await response.json()
 if(!response.ok){const failure=new Error(result.error||'Could not finish account access. Please try again.');failure.needsConsent=result.needsConsent===true;throw failure}
 return true
}
export async function finishLessonSignin(client,fetcher,fragment){
 const params=new URLSearchParams(fragment.replace(/^#/,'')),token_hash=params.get('token_hash'),type=params.get('type')
 // Accept older Supabase email callbacks as well as our current token-hash links.
 if(params.get('access_token')&&params.get('refresh_token')){
  const {data,error}=await client.auth.setSession({access_token:params.get('access_token'),refresh_token:params.get('refresh_token')})
  if(error)throw new Error('This login expired. Request a fresh login email.')
  return completeLessonAccess(fetcher,data?.session)
 }
 if(!fragment||fragment==='#'){
  const {data}=await client.auth.getSession()
  if(data?.session)return completeLessonAccess(fetcher,data.session)
 }
 if(!token_hash||!['magiclink','signup','email'].includes(type))throw new Error('Open the link from your latest login email, or enter its code on the login page.')
 const {data,error}=await client.auth.verifyOtp({token_hash,type})
 if(error)throw new Error('This link expired or was already used. Request a fresh login email, or return to the browser where you opened it.')
 return completeLessonAccess(fetcher,data?.session||(await client.auth.getSession()).data.session)
}
export async function finishLessonCode(client,fetcher,email,code){
 if(!/^\d{6,10}$/.test(code))throw new Error('Enter the verification code from your latest email.')
 const {data,error}=await client.auth.verifyOtp({email:email.trim().toLowerCase(),token:code,type:'email'})
 if(error)throw new Error('This code expired or is incorrect. Use your latest email or request a new one.')
 return completeLessonAccess(fetcher,data?.session)
}

export async function finishLessonSignin(client,fetcher,fragment){
 const params=new URLSearchParams(fragment.replace(/^#/,'')),token_hash=params.get('token_hash'),type=params.get('type')
 if(!token_hash||!['magiclink','signup'].includes(type))throw new Error('Open the secure link from your latest signup email.')
 const {data,error}=await client.auth.verifyOtp({token_hash,type})
 if(error)throw new Error('This link expired or has already been used. Request a fresh sign-in email.')
 const session=data?.session||(await client.auth.getSession()).data.session
 if(!session?.access_token)throw new Error('Could not finish sign-in. Please request a fresh email link.')
 const response=await fetcher('/api/lessonplan/access',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({completeFromEmail:true})})
 const result=await response.json()
 if(!response.ok){const failure=new Error(result.error||'Could not finish signup. Please try again.');failure.needsConsent=result.needsConsent===true;throw failure}
 return true
}

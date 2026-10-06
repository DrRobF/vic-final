export function lessonSignupEnabled(env){return env.LESSON_PUBLIC_SIGNUP_ENABLED!=='false'&&Boolean(env.RESEND_API_KEY&&env.REPORTS_FROM_EMAIL&&env.SUPABASE_SERVICE_ROLE_KEY&&env.NEXT_PUBLIC_SUPABASE_URL&&env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)}
export function signupEmail(body){
 if(body?.intent!==undefined&&!['signup','login'].includes(body.intent))throw new Error('Choose signup or login.')
 if(body?.intent!=='login'&&(body?.consent!==true||body?.adultEducator!==true))throw new Error('Confirm both signup checkboxes first.')
 const email=typeof body.email==='string'?body.email.trim().toLowerCase():''
 if(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Enter a valid email address.')
 return email
}
export function lessonSigninLink(properties){
 if(!properties?.hashed_token||!['magiclink','signup'].includes(properties.verification_type))throw new Error('Could not prepare email verification.')
 // Fragment is not sent to the site server or included in the HTTP Referer.
 return `https://www.askvic.ai/lessonplan/confirm#token_hash=${encodeURIComponent(properties.hashed_token)}&type=${properties.verification_type}`
}

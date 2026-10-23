// Entering the six-digit code from a sign-in email.
//
// The code is issued against the address Supabase knows the account by. When somebody
// signs in with an alias -- the school address issued after they signed up -- the code
// is NOT issued against what they typed, so verifying it has to happen where the alias
// can be resolved without telling the browser the account's other address.
export function codeRequest(body){
 const email=typeof body?.email==='string'?body.email.trim().toLowerCase():''
 if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Enter a valid email address.')
 const code=typeof body?.code==='string'?body.code.trim():''
 if(!/^\d{6,10}$/.test(code))throw new Error('Enter the verification code from your latest email.')
 return {email,code}
}

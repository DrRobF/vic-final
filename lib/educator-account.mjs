const EDUCATOR_ROUTES=new Set(['/educator','/lessonplan','/teacher','/askvic','/assistantprincipal','/admin/accounts','/admin/import-roster'])
export function educatorDestination(value){return typeof value==='string'&&EDUCATOR_ROUTES.has(value)?value:'/educator'}
export function schoolEducator(profile){return ['teacher','principal'].includes(String(profile?.role||'').toLowerCase())}
export function studentProfile(profile){return String(profile?.role||'').toLowerCase()==='student'}
export function canManageAccounts(auth,adminEmail){return auth?.user?.email?.toLowerCase()===adminEmail&&auth?.profile?.email?.toLowerCase()===adminEmail&&auth?.profile?.role==='teacher'}
export function accountPatch(body,profile){
 const id=Number(body?.id)
 if(!Number.isSafeInteger(id)||id<=0||id!==profile?.id)throw new Error('Select a valid account.')
 if(!['teacher','student','principal'].includes(profile.role))throw new Error('This account cannot be edited here.')
 const keys=Object.keys(body||{});if(keys.some(k=>!['id','name','parentEmail','interestTags'].includes(k)))throw new Error('Only profile details can be changed here. Login and permissions stay protected.')
 const name=typeof body.name==='string'?body.name.trim().replace(/\s+/g,' '):''
 if(!name||name.length>150)throw new Error('Enter a name of 1–150 characters.')
 const patch={name}
 if(profile.role==='student'){
  const parentEmail=typeof body.parentEmail==='string'?body.parentEmail.trim().toLowerCase():''
  if(parentEmail&&(parentEmail.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)))throw new Error('Enter a valid parent email or leave it blank.')
  const interestTags=typeof body.interestTags==='string'?body.interestTags.trim():''
  if(interestTags.length>1000)throw new Error('Keep student interests under 1,000 characters.')
  patch.parent_email=parentEmail||null;patch.interest_tags=interestTags.split(',').map(s=>s.trim()).filter(Boolean).slice(0,20)
 }else if('parentEmail' in body||'interestTags' in body)throw new Error('Student details can only be edited on student accounts.')
 return patch
}

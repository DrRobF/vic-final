export function studentAccountInput(body){
 const name=typeof body?.name==='string'?body.name.trim().replace(/\s+/g,' '):''
 const username=typeof body?.username==='string'?body.username.trim().toLowerCase():''
 if(!name||name.length>150)throw new Error('Enter the student’s full name (up to 150 characters).')
 if(!/^[a-z0-9][a-z0-9._-]{1,63}$/.test(username))throw new Error('Use a username of 2–64 letters, numbers, periods, underscores, or hyphens.')
 const classIds=body?.classIds??[]
 if(!Array.isArray(classIds)||classIds.length>20||classIds.some(id=>!Number.isSafeInteger(id)||id<=0))throw new Error('Choose up to 20 valid classrooms.')
 // The child's own grade. Optional, because a single-grade class answers it, but offered here
 // so a child added mid-year is not born blank -- which is how a Grade 4 child in a 3/4 class
 // ends up being taught Grade 3 with nobody able to see why.
 const rawGrade=String(body?.gradeLevel??'').trim().toLowerCase()
 const gradeLevel=['k','kindergarten'].includes(rawGrade)?0:rawGrade===''?null:Number(rawGrade)
 if(gradeLevel!==null&&(!Number.isInteger(gradeLevel)||gradeLevel<0||gradeLevel>12))throw new Error('Choose Kindergarten or grade 1–12, or leave the grade blank.')
 return {name,username,email:`${username}@students.askvic.ai`,classIds:[...new Set(classIds)],gradeLevel}
}
export function mayEnroll(auth,classroom,isAdmin){return auth?.profile?.role==='teacher'&&!!classroom&&(isAdmin||classroom.teacher_id===auth.profile.id)}
export function searchTerms(value){
 if(typeof value!=='string'||value.length>100)throw new Error('Search with a name or username up to 100 characters.')
 const terms=value.replace(/[^\p{L}\p{N}@ .+-]/gu,' ').trim().split(/\s+/).filter(Boolean).slice(0,5)
 if(!terms.length||terms.join('').length<2)throw new Error('Enter at least two letters of the name or username.')
 return terms
}

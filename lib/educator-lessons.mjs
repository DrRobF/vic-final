export function lessonLink(id){return `/lessonplan?lesson=${encodeURIComponent(id)}&view=lesson`}
export function validLessonId(id){return typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)}
export function lessonRecord(body,userId){
 if(!validLessonId(body?.id))throw new Error('Invalid lesson link.')
 const draft=body.draft
 if(!draft?.plan||typeof draft.plan.title!=='string'||!Array.isArray(draft.plan.sections)||!draft.input||typeof draft.input!=='object')throw new Error('A complete lesson draft is required.')
 if(JSON.stringify(draft).length>900000)throw new Error('This lesson is too large to save. Download a copy.')
 return {id:body.id,user_id:userId,title:draft.plan.title.trim().slice(0,300)||'Untitled lesson',subject:String(draft.input.subject||'').slice(0,100),grade:String(draft.input.grade||'').slice(0,60),draft,updated_at:new Date().toISOString()}
}

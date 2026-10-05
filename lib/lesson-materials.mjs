// One material contract for every subject; render once for web, copy and export.
export const KIT_LABELS={sourceMaterial:'Shared text / lesson stimulus',teacherModel:'Teacher model and think-aloud',discussionGuide:'Questions and discussion guide',studentTask:'Student task and handouts',supports:'Differentiation materials',assessment:'Exit ticket and success criteria'}
const string={type:'string'}
const list={type:'array',items:string}
const object=properties=>({type:'object',additionalProperties:false,required:Object.keys(properties),properties})
export function teachingKitSchema(){
 return object({sourceMaterial:string,teacherModel:string,
  discussionGuide:object({norms:string,questions:{type:'array',items:object({question:string,followUp:string,sampleResponse:string})}}),
  studentTask:object({directions:string,organizers:{type:'array',items:object({title:string,directions:string,fields:list})},individualCheck:string,checklist:list}),
  supports:string,
  assessment:object({directions:string,items:{type:'array',items:object({prompt:string,sampleResponse:string,successCriteria:string})}})
 })
}
const required=v=>{if(typeof v!=='string'||!v.trim())throw new Error('The teaching materials were incomplete. Please try again.');return v.trim()}
const numbered=(items,render)=>{if(!Array.isArray(items)||!items.length)throw new Error('The teaching materials were incomplete. Please try again.');return items.map((v,i)=>`${i+1}. ${render(v)}`).join('\n\n')}
export function materializeTeachingKit(kit){
 if(!kit)return kit
 const result={...kit}
 // Existing drafts keep their string fields and remain editable/exportable.
 if(typeof kit.discussionGuide!=='string'){
  const guide=kit.discussionGuide
  result.discussionGuide=`Discussion directions: ${required(guide?.norms)}\n\n${numbered(guide?.questions,q=>`${required(q.question)}\nFollow-up: ${required(q.followUp)}\nPossible response / evidence: ${required(q.sampleResponse)}`)}`
 }
 if(typeof kit.studentTask!=='string'){
  const task=kit.studentTask
  if(!Array.isArray(task?.organizers))throw new Error('The teaching materials were incomplete. Please try again.')
  const organizers=task.organizers.map(o=>`${required(o.title)}\nDirections: ${required(o.directions)}\n${numbered(o.fields,f=>`${required(f)}: ____________________`)}`)
  result.studentTask=[`Student directions: ${required(task.directions)}`,...organizers,`Individual evidence of learning: ${required(task.individualCheck)}`,`Student checklist:\n${numbered(task.checklist,required)}`].join('\n\n')
 }
 if(typeof kit.assessment!=='string'){
  const assessment=kit.assessment
  result.assessment=`Directions: ${required(assessment?.directions)}\n\n${numbered(assessment?.items,q=>`${required(q.prompt)}\nTeacher sample response / acceptable evidence: ${required(q.sampleResponse)}\nSuccess criteria: ${required(q.successCriteria)}`)}`
 }
 return Object.fromEntries(Object.entries(result).map(([key,value])=>[key,typeof value==='string'?readableMaterialReferences(value):value]))
}
export function readableMaterialReferences(value){
 return value.replace(/\bteachingKit\.(sourceMaterial|teacherModel|discussionGuide|studentTask|supports|assessment)\b/g,(_,key)=>KIT_LABELS[key])
}

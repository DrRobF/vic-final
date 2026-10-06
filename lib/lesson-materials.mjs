import {supplyScaledPictograph,calculationWarnings,tableFractionWarnings} from './lesson-quality.mjs'
// One material contract for every subject; render once for web, copy and export.
export const KIT_LABELS={sourceMaterial:'Shared text / lesson stimulus',teacherModel:'Teacher model and think-aloud',discussionGuide:'Questions and discussion guide',studentTask:'Student task and handouts',supports:'Differentiation materials',assessment:'Assessment and exit ticket'}
const string={type:'string'}
const list={type:'array',items:string}
const object=properties=>({type:'object',additionalProperties:false,required:Object.keys(properties),properties})
export function teachingKitSchema(){
 const evidence={responseType:{type:'string',enum:['text','inference','calculation','personal','performance']},sourceEvidence:string}
 return object({sourceMaterial:string,teacherModel:object({models:{type:'array',items:object({sessionNumber:{type:'integer'},example:string,thinkAloud:string})}}),
  discussionGuide:object({norms:string,questions:{type:'array',items:object({question:string,followUp:string,sampleResponse:string,...evidence})}}),
  studentTask:object({directions:string,sharedWork:string,individualWork:string,transition:string,organizers:{type:'array',items:object({title:string,directions:string,fields:list})},individualCheck:string,checklist:list}),
  supports:object({groups:{type:'array',items:object({group:string,materials:string,use:string})}}),
  assessment:object({directions:string,items:{type:'array',items:object({prompt:string,sampleResponse:string,successCriteria:string,...evidence})}})
 })
}
const required=v=>{if(typeof v!=='string'||!v.trim())throw new Error('The teaching materials were incomplete. Please try again.');return v.trim()}
const numbered=(items,render)=>{if(!Array.isArray(items)||!items.length)throw new Error('The teaching materials were incomplete. Please try again.');return items.map((v,i)=>`${i+1}. ${render(v)}`).join('\n\n')}
const compact=v=>String(v||'').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/\s+/g,' ').trim().toLowerCase()
function responseGuidance(q,source){
 const answer=required(q.sampleResponse)
 if(q.responseType===undefined)return answer // Legacy structured drafts.
 const evidence=compact(q.sourceEvidence),needsEvidence=['text','inference'].includes(q.responseType)
 if(q.responseType==='calculation')return `Worked reasoning: ${answer}${calculationWarnings(answer).length?'\n'+calculationWarnings(answer).join('\n'):''}`
 if((needsEvidence&&!evidence)||(evidence&&!compact(source).includes(evidence)))return `${answer}\nEvidence note: the supplied citation could not be verified against the lesson material. This is a suggested response; check its reasoning and evidence before using it.`
 const label=q.responseType==='inference'?'Possible interpretation (not a stated fact)':q.responseType==='calculation'?'Worked reasoning':'Possible response'
 return `${label}: ${answer}${evidence?`\nEvidence from supplied material: ${q.sourceEvidence.trim()}`:''}`
}
export function scheduleTeacherModels(sessions,kit){
 const withQuestions=sessions?.map(s=>{
  if(s.approach!=='inquiry'||typeof s.drivingQuestion!=='string'||!s.drivingQuestion.trim()||!s.phases?.length)return s
  const phases=s.phases.map(p=>({...p})),launch=Math.max(0,phases.findIndex(p=>p.kind==='launch'))
  phases[launch].teacherAction=`Driving question: ${s.drivingQuestion.trim()}\n${phases[launch].teacherAction}`
  return {...s,phases}
 })
 if(typeof kit?.teacherModel==='string'||!kit?.teacherModel)return withQuestions
 return (withQuestions||[]).map(s=>{
  const model=kit.teacherModel.models?.find(m=>m.sessionNumber===s.number)
  if(!model||!Array.isArray(s.phases))return s
  const phases=s.phases.map(p=>({...p})),investigation=phases.reduce((last,p,i)=>p.kind==='investigate'?i:last,-1)
  const after=s.approach==='inquiry'?investigation:-1
  let index=phases.findIndex((p,i)=>i>after&&p.kind==='model')
  if(index<0)index=phases.findIndex((p,i)=>i>after&&['discuss','closure','feedback'].includes(p.kind))
  if(index<0)index=phases.length-1
  if(index>=0){phases[index].teacherAction+=` ${s.approach==='inquiry'?'After students share their findings,':'During this step,'} use the supplied Teacher model and think-aloud for session ${s.number}.`;phases[index].materials+='; Teacher model and think-aloud'}
  return {...s,phases,modelPhaseNumber:index+1}
 })
}
export function modelingNotes(sessions){
 return (sessions||[]).filter(s=>s.modelPhaseNumber).map(s=>`Session ${s.number}, step ${s.modelPhaseNumber} — ${s.phases[s.modelPhaseNumber-1].title}: use the supplied Teacher model and think-aloud${s.approach==='inquiry'?' after students investigate and explain their findings':''}.`).join('\n\n')
}
export function materializeTeachingKit(kit,sessions=[]){
 if(!kit)return kit
 const result={...kit,sourceMaterial:supplyScaledPictograph(kit.sourceMaterial)}
 if(typeof kit.teacherModel!=='string')result.teacherModel=numbered(kit.teacherModel?.models,m=>{
  const session=sessions.find(s=>s.number===m.sessionNumber)
  return `Session ${m.sessionNumber}${session?.modelPhaseNumber?`, step ${session.modelPhaseNumber} — ${session.phases[session.modelPhaseNumber-1].title}`:''}\nComplete example: ${required(m.example)}\nThink-aloud: ${required(m.thinkAloud)}`
 })
 if(typeof kit.supports!=='string')result.supports=numbered(kit.supports?.groups,g=>`${required(g.group)}\nSupplied support / extension material:\n${required(g.materials)}\nHow to use it: ${required(g.use)}`)
 // Existing drafts keep their string fields and remain editable/exportable.
 if(typeof kit.discussionGuide!=='string'){
  const guide=kit.discussionGuide
  result.discussionGuide=`Discussion directions: ${required(guide?.norms)}\n\n${numbered(guide?.questions,q=>`${required(q.question)}\nFollow-up: ${required(q.followUp)}\nPossible response / evidence: ${responseGuidance(q,kit.sourceMaterial)}`)}`
 }
 if(typeof kit.studentTask!=='string'){
  const task=kit.studentTask
  if(!Array.isArray(task?.organizers))throw new Error('The teaching materials were incomplete. Please try again.')
  const organizers=task.organizers.map(o=>`${required(o.title)}\nDirections: ${required(o.directions)}\n${numbered(o.fields,f=>`${required(f)}: ____________________`)}`)
  const ownership=task.sharedWork===undefined?[]:[`Shared work: ${required(task.sharedWork)}`,`Each student's own work: ${required(task.individualWork)}`,`Moving from shared to individual work: ${required(task.transition)}`]
  result.studentTask=[`Student directions: ${required(task.directions)}`,...ownership,...organizers,`Individual evidence of learning: ${required(task.individualCheck)}`,`Student checklist:\n${numbered(task.checklist,required)}`].join('\n\n')
 }
 if(typeof kit.assessment!=='string'){
  const assessment=kit.assessment
  result.assessment=`Directions: ${required(assessment?.directions)}\n\n${numbered(assessment?.items,q=>`${required(q.prompt)}\nTeacher sample response / acceptable evidence: ${responseGuidance(q,kit.sourceMaterial)}\nSuccess criteria: ${required(q.successCriteria)}`)}`
 }
 return Object.fromEntries(Object.entries(result).map(([key,value])=>[key,typeof value==='string'?readableMaterialReferences(value):value]))
}
export function readableMaterialReferences(value){
 return String(value||'')
  .replace(/\b(?:teachingKit\.)?studentTask[. ]+organizers\s*(?:\[\s*["']([^"']+)["']\s*\])?/g,(_,name)=>name||'Student task and handouts')
  .replace(/\b(?:teachingKit\.)?studentTask[. ]+individualWork\b/g,"Each student's own work (Student task and handouts)")
  .replace(/\bteachingKit\.(sourceMaterial|teacherModel|discussionGuide|studentTask|supports|assessment)\b/g,(_,key)=>KIT_LABELS[key])
  .replace(/\b(sourceMaterial|teacherModel|discussionGuide|studentTask)\b/g,(_,key)=>KIT_LABELS[key])
}

export function teachingKitQualityNotes(kit){return [...new Set([...tableFractionWarnings(kit),...calculationWarnings(JSON.stringify(kit))])]}

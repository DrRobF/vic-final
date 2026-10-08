import {lessonTargets} from './lesson-companion.mjs'

const value = v => typeof v==='string'?v.trim():''
const section = (title,body) => ({title,body:value(body)})
const edited = (plan,key,original) => value(plan?.displayEdits?.[`kit_${key}`]??original)
export function studentAssessment(text){
 return value(text).split(/(?=\n\s*\d+\.\s)/).map(part=>part.split(/Teacher sample response \/ acceptable evidence:|Possible response \/ evidence:|Success criteria:/i)[0].trim()).filter(part=>/^\d+\./.test(part)).join('\n\n')
}
export function studentSupports(text){
 const source=value(text),groups=[...source.matchAll(/(?:^|\n\n)(\d+\.\s*[^\n]+)\nSupplied support \/ extension material:\n([\s\S]*?)\nHow to use it:/g)]
 return groups.map(([,name,material])=>section(name,material)).filter(s=>s.body)
}
export function buildLessonPacket(draft){
 const plan=draft?.plan||{},kit=plan.teachingKit||{},input=draft?.input||{},worksheet=draft?.worksheet
 const targets=lessonTargets(draft)
 const student=[section('Learning goal',targets.objectives.join('\n')||input.topic),section('Shared passage or lesson source',edited(plan,'sourceMaterial',kit.sourceMaterial)),section('Student directions, organizers and checklist',edited(plan,'studentTask',kit.studentTask)),section('Exit ticket',studentAssessment(edited(plan,'assessment',kit.assessment)))]
 const teacher=[section('Standards and learning objectives',[...targets.standards,...targets.objectives].join('\n')),section('Materials and preparation',plan.sections?.filter(s=>/materials|preparation/i.test(s.heading)).map(s=>s.body).join('\n\n')),section('Teacher model and think-aloud',edited(plan,'teacherModel',kit.teacherModel)),section('Discussion guide and possible responses',edited(plan,'discussionGuide',kit.discussionGuide)),section('Differentiation guidance',edited(plan,'supports',kit.supports)),section('Assessment and answer guidance',edited(plan,'assessment',kit.assessment))]
 const supports=studentSupports(edited(plan,'supports',kit.supports))
 if(worksheet?.versions?.length){
  for(const version of worksheet.versions){
   const studentWorksheet=section(`${version.label||'Practice'} — worksheet`,[version.directions,version.passage,...(version.questions||[]).map((q,i)=>`${i+1}. ${q.prompt}\n\n________________________________________________________________\n\n________________________________________________________________`)].filter(Boolean).join('\n\n'))
   const destination=worksheet.versions.length===1?student:supports
   destination.push(studentWorksheet)
   teacher.push(section(`${version.label||'Practice'} — answer key`,(version.questions||[]).map((q,i)=>`${i+1}. ${q.prompt}\nAnswer: ${q.answer}`).join('\n\n')))
  }
 }
 return {student:student.filter(s=>s.body),teacher:teacher.filter(s=>s.body),supports:supports.filter(s=>s.body),updated_at:null}
}
export function validatePacket(value){
 if(!value||typeof value!=='object')throw new Error('Packet is missing.')
 const result={}
 for(const audience of ['student','teacher','supports']){
  const sections=value[audience]
  if(!Array.isArray(sections)||sections.length>30||(['student','teacher'].includes(audience)&&!sections.length))throw new Error('Packet sections are missing or too long.')
  result[audience]=sections.map(s=>{if(typeof s?.title!=='string'||!s.title.trim()||s.title.length>150||typeof s.body!=='string'||s.body.length>18000)throw new Error('Keep each handout title and body within the size limits.');return section(s.title,s.body)})
 }
 if(JSON.stringify(result).length>95000)throw new Error('This packet is too large. Shorten the materials.')
 return result
}
export function packetText(sections,title){return `${title}\n\n${sections.map(s=>`${s.title}\n\n${s.body}`).join('\n\n--- NEW PAGE ---\n\n')}`}

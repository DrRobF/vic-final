// Structured activities are the source of the visible running order, not a second summary.
const nonempty=v=>typeof v==='string'&&v.trim().length>0
const compact=v=>v.replace(/\s+/g,' ').trim().toLowerCase()
// Only explicit change requests override stored selections; references and negations do not.
export function requestedBehavior(body){
 const request=typeof body.revision==='string'?body.revision.toLowerCase():''
 const result={...body}
 const clauses=request.split(/[.!?;\n]|\bbut\b/).filter(c=>! /\b(?:not|don't|do not|avoid|without|keep)\b/.test(c))
 const targets={inquiry:'inquiry|discovery',socratic:'socratic|seminar',explicit:'explicit teaching|direct instruction',problem:'problem[- ]based',project:'project[- ]based'}
 for(const [key,phrase] of Object.entries(targets))if(clauses.some(c=>new RegExp(`(?:make|convert|change|switch|turn|use|want|try|into|to)\\b[^.!?;]{0,60}\\b(?:${phrase})\\b`).test(c)||new RegExp(`^\\s*(?:${phrase})(?: lesson)?\\s*$`).test(c)))result.lessonStyle=key
 if(clauses.some(c=>/(?:add|include|use|want|with)\b.{0,50}\b(?:collaborative|group|team) (?:challenge|task|project)\b/.test(c)))result.creativeActivity='group'
 if(body.previousPlan&&result.lessonStyle&&result.lessonStyle!==body.lessonStyle){result.startingPoint='convert';result.sourceLesson=body.previousPlan;result.preserveExisting=false}
 return result
}
export function effectiveStartingPoint(startingPoint,style){
 return startingPoint==='refresh'&&style!=='recommend'?'convert':startingPoint
}
export function activitySessionSchema(){
 const string={type:'string'}
 const challenge={type:'object',additionalProperties:false,required:['brief','roles','product','successCriteria'],properties:{brief:string,roles:string,product:string,successCriteria:string}}
 const phase={type:'object',additionalProperties:false,required:['kind','title','minutes','teacherAction','studentAction','materials'],properties:{kind:{type:'string',enum:['launch','investigate','model','discuss','collaborate','create','practice','feedback','revise','assess','closure']},title:string,minutes:{type:'integer'},teacherAction:string,studentAction:string,materials:string}}
 return {type:'object',additionalProperties:false,required:['title','approach','phases','challenge','assessment'],properties:{title:string,approach:{type:'string',enum:['explicit','inquiry','socratic','problem','project']},phases:{type:'array',items:phase},challenge:{anyOf:[challenge,{type:'null'}]},assessment:string}}
}
export function changeEvidenceSchema(){
 return {type:'array',items:{type:'object',additionalProperties:false,required:['originalExcerpt','sessionNumber','phaseNumber','reason'],properties:{originalExcerpt:{type:'string'},sessionNumber:{type:'integer'},phaseNumber:{type:'integer'},reason:{type:'string'}}}}
}
export function renderActivitySteps(session){
 return session.phases.map((p,i)=>`${i+1}. ${p.title} (${p.minutes} min)\nTeacher: ${p.teacherAction}\nStudents: ${p.studentAction}\nMaterials: ${p.materials}`).join('\n\n')
}
export function hasScheduledAssessment(session){
 return session.phases?.some(p=>p.kind==='assess'||/\b(?:exit ticket|quiz|assessment)\b/i.test(`${p.title} ${p.studentAction}`)||/\b(?:check|assess|evaluate|review|collect|monitor|observe)\b.{0,100}\b(?:understanding|responses?|answers?|reasoning|evidence|tickets?|work|products?|explanations?)\b/i.test(p.teacherAction))
}
export function scheduleExistingAssessment(session,kit){
 if(!Array.isArray(session?.phases)||hasScheduledAssessment(session)||!nonempty(kit?.assessment)||!nonempty(session.assessment))return session
 // Preserve all teaching content. Reserve time for the already supplied exit ticket.
 // Do not repair malformed phases or incorrect totals; normal validation still handles those.
 if(session.phases.some(p=>!p||!Number.isInteger(p.minutes)||p.minutes<1))return session
 const candidates=session.phases.map((p,i)=>({p,i})).filter(({p})=>['practice','create','investigate','collaborate','discuss'].includes(p.kind)&&p.minutes>=6).sort((a,b)=>b.p.minutes-a.p.minutes)
 const donor=candidates[0]
 if(!donor)return session
 const phases=session.phases.map(p=>({...p}))
 phases[donor.i].minutes-=3
 phases.push({kind:'assess',title:'Exit ticket and evidence of learning',minutes:3,teacherAction:`Collect and review responses using Exit ticket and success criteria. Check: ${session.assessment}`,studentAction:'Complete the questions supplied in Exit ticket and success criteria independently, showing reasoning where requested.',materials:'Exit ticket and success criteria; paper and pencil'})
 return {...session,phases,assessmentTimingAdjusted:true}
}
export function validateActivityDesign(plan,input,required=false){
 if(!required&&!plan.sessions?.some(s=>s.phases))return
 for(const s of plan.sessions||[]){
  if(!Array.isArray(s.phases)||s.phases.length<3||s.phases.length>12||s.phases.some(p=>!p||!Number.isInteger(p.minutes)||p.minutes<1||['kind','title','teacherAction','studentAction','materials'].some(k=>!nonempty(p[k])))||s.phases.reduce((n,p)=>n+p.minutes,0)!==input.minutes)throw new Error('The activity sequence or time budget was incomplete.')
  if(!['explicit','inquiry','socratic','problem','project'].includes(s.approach)||(input.lessonStyle!=='recommend'&&s.approach!==input.lessonStyle))throw new Error('The lesson did not use the selected approach.')
  const kinds=s.phases.map(p=>p.kind),investigation=s.phases.findIndex(p=>p.kind==='investigate'||(p.kind==='collaborate'&&/investigat|test|compar|examin|evidence/i.test(p.studentAction))),model=kinds.indexOf('model')
  if(s.approach==='inquiry'&&(investigation<0||!kinds.some(k=>k==='discuss'||k==='collaborate')||(model>=0&&model<investigation)))throw new Error('Inquiry needs student investigation before teacher explanation.')
  if(s.approach==='explicit'&&(!kinds.includes('model')||!kinds.includes('practice')))throw new Error('Explicit teaching needs modeling and practice.')
  if(s.approach==='socratic'&&!kinds.includes('discuss'))throw new Error('A seminar needs scheduled discussion.')
  if(['problem','project'].includes(s.approach)&&!kinds.includes('create')&&!kinds.includes('collaborate'))throw new Error('This approach needs a scheduled solution or product.')
  if(['mini','design'].includes(input.creativeActivity)&&!kinds.includes('create')&&!kinds.includes('collaborate'))throw new Error('The requested creative product needs scheduled creation time.')
  if(input.creativeActivity==='investigation'&&!kinds.includes('investigate'))throw new Error('The requested investigation needs scheduled investigation time.')
  if(input.creativeActivity==='debate'&&!kinds.includes('discuss'))throw new Error('The requested debate needs scheduled discussion time.')
  if(!hasScheduledAssessment(s))throw new Error('The lesson needs scheduled assessment.')
  if(input.creativeActivity==='group'&&(!kinds.includes('collaborate')||!s.challenge))throw new Error('The collaborative challenge was missing.')
  if(s.challenge&&['brief','roles','product','successCriteria'].some(k=>!nonempty(s.challenge[k])))throw new Error('The team task needs roles, a product and success criteria.')

 }
 if(/\brevis(?:e|ing|ion)\b/i.test((plan.objectives||[]).map(o=>o.statement).join(' '))){const kinds=(plan.sessions||[]).flatMap(s=>s.phases.map(p=>p.kind));const feedback=kinds.indexOf('feedback');if(feedback<0||!kinds.slice(feedback+1).includes('revise'))throw new Error('Writing revision needs time after feedback.')}


}
export function supportedChanges(raw,sessions,input){
 if(input.startingPoint==='new')return {changes:[],warnings:[]}
 const supported=(Array.isArray(raw.changeEvidence)?raw.changeEvidence:[]).filter(e=>e&&Number.isInteger(e.sessionNumber)&&Number.isInteger(e.phaseNumber)&&e.sessionNumber>0&&e.phaseNumber>0&&nonempty(e.originalExcerpt)&&nonempty(e.reason)&&compact(input.sourceLesson).includes(compact(e.originalExcerpt))&&sessions?.[e.sessionNumber-1]?.phases?.[e.phaseNumber-1]&&compact(e.originalExcerpt)!==compact(sessions[e.sessionNumber-1].phases[e.phaseNumber-1].studentAction))
 const changes=supported.map(e=>{const phase=sessions[e.sessionNumber-1].phases[e.phaseNumber-1];return `Before: ${e.originalExcerpt}\nNow (session ${e.sessionNumber}, step ${e.phaseNumber}): ${phase.studentAction}\nWhy: ${e.reason}`})
 return {changes,warnings:changes.length?[]:['The lesson was generated, but VIC could not support a before-and-after summary with a matching original excerpt. Review the activity sequence against your original lesson.']}
}
export function lessonFailure(error,data){
 if(data?.status==='incomplete')return {code:'draft_truncated',error:'The lesson response was cut short before it finished. Try fewer sections or sessions.'}
 if(error instanceof SyntaxError||error instanceof TypeError||error?.name==='SyntaxError'||error?.name==='TypeError')return {code:'draft_structure',error:'VIC returned an incomplete lesson structure. Your previous draft is still saved.'}
 return {code:'lesson_quality_check',error:`${error.message} Your previous draft is still saved.`}
}
export function behaviorInstructions(){return `
PRESERVE SPECIFICITY ON REVISION: Keep useful concrete questions, examples, stimulus data and scaffolds from previousPlan or sourceLesson unless incompatible with the new approach. Adapt their function and timing; do not replace them with generic topic descriptions. Any referenced scenario card, table, organizer or task must be supplied in full with quantities, headings, student directions and teacher answers where appropriate. For example a ratio investigation needs actual competing recipe quantities and table rows, not "choose a real-world scenario". An example of sufficient specificity for ratio content: teams compare 3 cups concentrate + 2 cups water, 6 + 4, and 6 + 5; decide which mixtures preserve taste; record concentrate, water, total and ratio in supplied organizer fields; defend why 6:4 matches 3:2 while 6:5 does not. Use an equally concrete, fresh challenge appropriate to the actual lesson rather than copying this example across unrelated topics. Discussion questions must use the lesson stimulus and invite reasoning. Never lose useful detail merely to shorten a conversion.\nACTIVITY DESIGN CONTRACT: Each session has an approach and an ordered phases array. These phases become the displayed numbered lesson steps automatically: do not write a competing sequence in sections. Each phase has positive whole minutes; the sum MUST equal input.minutes including transitions. Include specific teacherAction and studentAction and exact teaching-kit labels in materials. Select approach from the input or, for recommend on refresh, retain the original approach. For recommend on convert, choose a genuinely different approach from the source.
INQUIRY: Launch a debatable driving question without giving its answer. Students predict and investigate the supplied stimulus, record evidence and compare explanations before any teacher model of the answer. Use phase kinds launch, investigate, discuss, then model only if useful AFTER investigation. teacherModel must model the PROCESS with a separate example, not reveal the target interpretation before students investigate. discussionGuide needs probing questions, rival interpretations and evidence. Retain a usable original passage; change the intellectual work students do with it.
COLLABORATIVE CHALLENGE: When group is selected, each session needs a non-null challenge with an actual student-facing brief, complementary team roles, a shared product (evidence map, ranked solution, tested design etc.), and observable successCriteria. Schedule a collaborate phase that explicitly implements that challenge. Ordinary individual writing with peer feedback is insufficient. Integrate the challenge into investigation rather than tacking it on after a full lesson. The application automatically inserts these challenge details into studentTask. In the raw teachingKit.studentTask provide the organizer fields, individual follow-up directions and checklist; do not repeat the challenge brief, roles or product there. Reference this same challenge from collaborate phase actions. For other choices use challenge null unless an actual team challenge is useful. For mini-project or creative design, schedule create or collaborate; for investigation schedule investigate; for debate schedule discuss. Supply the actual brief, product and criteria in studentTask for those activities.
REFRESH: Keep the core approach, subject, standards, useful source text and goals. Improve task clarity, scaffolds, examples, checks for understanding and student participation as requested; supply missing ready-to-use materials. Preserve useful parts, not weaknesses or every old instruction. A refresh must make an observable improvement, not only reword headings. When a new approach is selected, input.startingPoint is convert automatically. Honor natural-language requests for a different approach even if the selector is recommend.
CONVERT: Retain learning targets and usable source materials, but REBUILD the learning sequence and student work for the selected approach. Old session steps are reference, not a template to copy. Preserve timing and differentiation needs, NOT the old activity mechanics. Change roles, questioning, task/product and assessment as appropriate. Never relabel an unchanged seminar inquiry or an unchanged paragraph a project. Provide all new questions, organizer fields, challenge directions and assessment criteria in the kit. If revision is an objective, schedule feedback followed by actual revise time, not merely an intention to revise.
CHANGE EVIDENCE: For refresh or convert, provide 1–4 changeEvidence items. Each originalExcerpt must be a short exact excerpt from sourceLesson identifying an old activity or missing/weak instruction; sessionNumber and phaseNumber point to the new activity that improves or replaces it; reason explains the instructional benefit. The displayed change summary will use the actual linked studentAction, so do not make unsupported conversion claims. For new lessons return an empty changeEvidence array. All section bodies and kit details must agree with these phases and fit their time allocations.
`}

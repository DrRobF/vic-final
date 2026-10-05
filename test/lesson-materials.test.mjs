import test from 'node:test'
import assert from 'node:assert/strict'
import { teachingKitSchema, materializeTeachingKit, KIT_LABELS } from '../lib/lesson-materials.mjs'
import { supportedChanges, renderActivitySteps, activityReviewNotes } from '../lib/lesson-behavior.mjs'
import { normalizeLessonInput, lessonSchema, materializeLessonPlan, validateLessonPlan, lessonOutputSections, buildLessonInstructions, DEFAULT_SECTIONS } from '../lib/lesson-designer.mjs'

const examples=[
 {subject:'reading',topic:'Character motivation',standard:'Use actions and dialogue to support an interpretation.',stimulus:'Sam hesitated but returned to help a classmate.',question:'Could Sam be brave while feeling afraid?',answer:'Yes. Returning to help is evidence of bravery despite hesitation.',fields:['Claim','Action or dialogue','Explanation']},
 {subject:'math',topic:'Equivalent fractions',standard:'Explain equivalence using visual models.',stimulus:'Two strips: one has 2 of 4 parts shaded; one has 1 of 2 shaded.',question:'Do the strips show the same amount?',answer:'Yes: both show one half when the strips are equal wholes.',fields:['Model','Fraction','Justification']},
 {subject:'science',topic:'Plant investigation',standard:'Use observations to support a scientific explanation.',stimulus:'Plant A grew 4 cm in light; plant B grew 1 cm in darkness. Both received equal water.',question:'What might explain the difference?',answer:'Light is a plausible explanation; repeated trials and control of other variables are needed.',fields:['Prediction','Observation','Evidence','Limitation']},
 {subject:'social studies',topic:'Evaluating a historical claim',standard:'Compare sources and distinguish evidence from inference.',stimulus:'Source A is a contemporary diary; Source B is a later recollection that disagrees about the date.',question:'Which source should we trust for the date?',answer:'The contemporary diary may be stronger for timing, but corroboration and perspective matter.',fields:['Claim','Source','Corroboration needed']},
 {subject:'music',topic:'Rhythmic composition',standard:'Create and perform a rhythm within a specified meter.',stimulus:'Four beats per bar: quarter note, quarter note, two eighth notes, quarter note.',question:'Can another rhythm fit this meter?',answer:'Many rhythms can total four beats; demonstrate one and count the durations.',fields:['Rhythm','Beat counts','Revision after rehearsal']}
]
const kitFor=e=>({sourceMaterial:e.stimulus,teacherModel:{models:[{sessionNumber:1,example:e.stimulus,thinkAloud:e.answer}]},discussionGuide:{norms:'Explain reasoning and consider evidence from others.',questions:[{question:e.question,followUp:'What evidence supports your explanation?',sampleResponse:e.answer,responseType:'inference',sourceEvidence:e.stimulus}]},studentTask:{directions:`Compare explanations for ${e.topic} and justify a shared conclusion.`,sharedWork:'One team evidence map.',individualWork:'An individual explanation with evidence.',transition:'Use the shared map to draft your own explanation, then exchange your own drafts.',organizers:[{title:`${e.topic} organizer`,directions:'Record your evidence and reasoning.',fields:e.fields}],individualCheck:'Independently explain one decision using evidence from the stimulus.',checklist:['Uses the stimulus','Justifies the decision']},supports:{groups:[{group:'Support with a model.',materials:'Evidence: '+e.stimulus+'\nExplanation: '+e.answer+'\nStudent stem: My evidence is __ because __.',use:'Read the supplied model, then complete your own response.'}]},assessment:{directions:'Respond independently; a demonstration may accompany the explanation.',items:[{prompt:e.question,sampleResponse:e.answer,successCriteria:'Uses accurate evidence and explains how it supports the response.',responseType:'inference',sourceEvidence:e.stimulus}]}})
function schemaAccepts(schema,value){
 if(schema.type==='object'){
  assert.ok(value&&typeof value==='object'&&!Array.isArray(value))
  assert.deepEqual(Object.keys(value).sort(),schema.required.toSorted())
  for(const [key,item] of Object.entries(value))schemaAccepts(schema.properties[key],item)
 }else if(schema.type==='array'){
  assert.ok(Array.isArray(value));value.forEach(item=>schemaAccepts(schema.items,item))
 }else if(schema.type==='integer')assert.ok(Number.isInteger(value))
 else assert.equal(typeof value,schema.type)
}
test('Strict materials schema and rendering support different disciplines without a default lesson',()=>{
 for(const e of examples){
  const input=normalizeLessonInput({state:'Teacher-selected',grade:'6',subject:e.subject,topic:e.topic,minutes:45,customCode:'LOCAL-GOAL',customStandard:e.standard,sections:DEFAULT_SECTIONS,groups:['Support with a model.']},[])
  const kit=kitFor(e);schemaAccepts(teachingKitSchema(),kit)
  const providerSchema=lessonSchema(input.sections,input.standards,input)
  schemaAccepts(providerSchema.properties.teachingKit,kit)
  const phases=['launch','investigate','discuss'].map((kind,i)=>({kind,title:`${e.topic}: ${kind}`,minutes:15,teacherAction:'Ask for evidence and compare reasoning.',studentAction:i===1?'Investigate the supplied stimulus.':'Explain your reasoning.',materials:'teachingKit.sourceMaterial; teachingKit.studentTask'}))
  const raw={title:e.topic,teachingKit:kit,sections:Object.fromEntries(input.sections.map((_,i)=>[`section_${i+1}`,'Use the supplied materials.'])),objectives:Object.fromEntries([1,2].map(n=>[`objective_${n}`,{statement:`Students will be able to explain ${e.topic}, goal ${n}.`,standardCodes:['LOCAL-GOAL'],activity:'Investigate the stimulus.',assessment:'Explain evidence independently.'}])),alignment:{standard_1:{objective:e.standard,activity:'Investigate.',assessment:'Explain evidence.'}},sessions:{session_1:{title:e.topic,approach:'inquiry',drivingQuestion:e.question,phases,challenge:null,assessment:e.question}},changes:[],changeEvidence:[],reviewNotes:[]}
  const plan=validateLessonPlan(materializeLessonPlan(raw,input),input,true)
  assert.equal(plan.teachingKit.sourceMaterial,e.stimulus)
  assert.match(plan.teachingKit.discussionGuide,/Follow-up:/);assert.ok(plan.teachingKit.discussionGuide.includes(e.answer))
  for(const field of e.fields)assert.ok(plan.teachingKit.studentTask.includes(`${field}: ____________________`))
  assert.match(plan.teachingKit.studentTask,/Individual evidence of learning:/)
  assert.ok(plan.teachingKit.assessment.includes(e.answer));assert.match(plan.teachingKit.assessment,/Success criteria:/)
  assert.ok(!plan.sessions[0].steps.includes('teachingKit.'))
  assert.match(plan.sessions[0].steps,/Driving question:/);assert.match(plan.teachingKit.studentTask,/Each student.s own work:/);assert.match(plan.sessions[0].steps,/After students share their findings/);assert.match(plan.teachingKit.teacherModel,/step 3/);assert.match(plan.sections.find(s=>s.heading==='Teaching and modeling').body,/step 3/)
  assert.ok(plan.teachingKit.supports.includes(e.stimulus));assert.ok(plan.teachingKit.discussionGuide.includes('Evidence from supplied material:'))
  const output=lessonOutputSections(plan,input);assert.ok(output.some(s=>s.body.includes(e.answer)))
 }
})
test('Incomplete structured questions, organizers and assessments cannot become vague material descriptions',()=>{
 for(const mutate of [k=>k.discussionGuide.questions[0].sampleResponse='',k=>k.discussionGuide.questions[0].followUp='',k=>k.studentTask.organizers[0].fields=[],k=>k.studentTask.individualCheck='',k=>k.assessment.items[0].sampleResponse='']){
  const kit=kitFor(examples[0]);mutate(kit);assert.throws(()=>materializeTeachingKit(kit),/teaching materials/)
 }
 const kit=kitFor(examples[4]);kit.studentTask.organizers=[];assert.doesNotThrow(()=>materializeTeachingKit(kit))
})
test('Legacy materials stay exportable and internal references become teacher-facing labels',()=>{
 const kit=Object.fromEntries(Object.keys(KIT_LABELS).map(k=>[k,`Use teachingKit.${k}.`]))
 const rendered=materializeTeachingKit(kit)
 for(const [key,label] of Object.entries(KIT_LABELS))assert.equal(rendered[key],`Use ${label}.`)
 assert.match(renderActivitySteps({phases:[{title:'Explore',minutes:10,teacherAction:'Ask.',studentAction:'Explain.',materials:'teachingKit.discussionGuide'}]}),/Materials: Questions and discussion guide/)
})
test('Change summaries use actual new steps instead of contradictory model-written reasons',()=>{
 const phases=[{title:'Investigate first',studentAction:'Compare evidence.',teacherAction:'Probe without revealing the answer.'},{title:'Model after investigation',studentAction:'Compare the model with your claim.',teacherAction:'Model reasoning from the shared stimulus.'}]
 const result=supportedChanges({changeEvidence:[{originalExcerpt:'Teacher models before students investigate.',sessionNumber:1,phaseNumber:2,reason:'Students now investigate at step 2.'}]},[{phases}],{startingPoint:'convert',sourceLesson:'Teacher models before students investigate.'})
 assert.equal(result.changes.length,1);assert.match(result.changes[0],/step 2 — Model after investigation/)
 assert.match(result.changes[0],/Teacher: Model reasoning/);assert.ok(!result.changes[0].includes('Students now investigate at step 2.'))
})
test('Integrated peer feedback and revision are recognized without imposing separate timed blocks',()=>{
 const plan={objectives:[{statement:'Students will be able to revise their explanation.'}],sessions:[{approach:'explicit',phases:[{kind:'practice',minutes:45,title:'Improve',teacherAction:'Offer feedback as groups work.',studentAction:'Apply peer feedback and revise your explanation.'}]}]}
 assert.ok(!activityReviewNotes(plan,{minutes:45}).some(n=>n.includes('separate timed revision')))
})
test('Generation instructions resolve modeling conflicts and preserve open-ended answers across subjects',()=>{
 const text=buildLessonInstructions()
 assert.match(text,/EVERY subject, grade and supplied standard/);assert.match(text,/AFTER investigation/)
 assert.match(text,/defensible interpretations or alternative solutions/);assert.match(text,/individualCheck/)
 assert.ok(!text.includes('Mia'));assert.ok(!text.includes('3 cups concentrate'))
 assert.ok(!text.includes('for inquiry use a separate process example before investigation'))
})


test('Unsupported answer evidence is withheld without failing the entire lesson',()=>{
 const kit=kitFor(examples[0]);kit.discussionGuide.questions[0].sourceEvidence='The animals taught Sam to fly.';kit.discussionGuide.questions[0].sampleResponse='Sam learned to fly.'
 kit.assessment.items[0].sourceEvidence='Unwritten event.';kit.assessment.items[0].sampleResponse='Invented explanation.'
 const rendered=materializeTeachingKit(kit)
 assert.ok(!rendered.discussionGuide.includes('Sam learned to fly.'));assert.ok(!rendered.assessment.includes('Invented explanation.'))
 assert.match(rendered.discussionGuide,/Teacher review needed/);assert.match(rendered.assessment,/Teacher review needed/)
})
test('Personal and performance responses can have no text evidence; inferred answers are labeled',()=>{
 const kit=kitFor(examples[4]);kit.discussionGuide.questions[0].responseType='performance';kit.discussionGuide.questions[0].sourceEvidence=''
 assert.ok(materializeTeachingKit(kit).discussionGuide.includes(examples[4].answer))
 assert.match(materializeTeachingKit(kitFor(examples[0])).discussionGuide,/Possible interpretation \(not a stated fact\)/)
})
test('Inquiry modeling is attached after investigation without adding minutes or rejecting the lesson',async()=>{
 const e=examples[0],kit=kitFor(e),sessions=[{number:1,approach:'inquiry',phases:[{kind:'launch',title:'Question',minutes:5,teacherAction:'Ask the question.',studentAction:'Predict.',materials:'Stimulus'},{kind:'investigate',title:'Test ideas',minutes:30,teacherAction:'Listen.',studentAction:'Gather evidence.',materials:'Stimulus'},{kind:'discuss',title:'Compare findings',minutes:10,teacherAction:'Compare claims.',studentAction:'Defend a claim.',materials:'Discussion guide'}]}]
 const {scheduleTeacherModels,modelingNotes}=await import('../lib/lesson-materials.mjs')
 const result=scheduleTeacherModels(sessions,kit)
 assert.equal(result[0].modelPhaseNumber,3);assert.equal(result[0].phases.reduce((n,p)=>n+p.minutes,0),45)
 assert.ok(!result[0].phases[0].teacherAction.includes('Teacher model'));assert.match(result[0].phases[2].teacherAction,/After students share their findings/)
 assert.match(modelingNotes(result),/step 3 — Compare findings/)
 assert.equal(sessions[0].phases[2].teacherAction,'Compare claims.')
})

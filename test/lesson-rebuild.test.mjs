import test from 'node:test'
import assert from 'node:assert/strict'
import {extractLessonTargets,extractLessonStimulus} from '../lib/lesson-rebuild.mjs'
import {normalizeLessonInput,lessonGenerationInput,DEFAULT_SECTIONS} from '../lib/lesson-designer.mjs'
import {requestedBehavior} from '../lib/lesson-behavior.mjs'
const source=`Old seminar title
Grade 6
Subject: Science
45 minutes each
Standards
LOCAL.SCI.1: Use evidence to explain a change.
Learning objectives
1. Students will be able to explain a change using observations.
Standards: LOCAL.SCI.1
Activity: OLD_LECTURE_MECHANICS
Evidence of learning: OLD_QUIZ
2. Students will be able to revise an explanation using feedback.
Session plan
OLD_SEMINAR_STEPS
Shared text / lesson stimulus
Title: Water observations
Cup A loses 5 mL; covered cup B loses 1 mL.
Teacher model and think-aloud
OLD_EXAMPLE
Standard alignment
Objective: Students will be able to explain a change using observations.
Activity: OLD_ALIGNMENT_ACTIVITY`
const base={state:'Any state',grade:'6',subject:'science',topic:'Old seminar title',minutes:45,sections:DEFAULT_SECTIONS,groups:['Support with a model.'],customStandard:'Use evidence to explain a change.',startingPoint:'convert',sourceLesson:source,lessonStyle:'problem',creativeActivity:'roleplay'}
test('Target extraction excludes repeated alignment statements and old activities',()=>{
 const targets=extractLessonTargets(source)
 assert.deepEqual(targets.objectives,['Students will be able to explain a change using observations.','Students will be able to revise an explanation using feedback.'])
 assert.equal(targets.standardsText,'LOCAL.SCI.1: Use evidence to explain a change.')
 assert.ok(!JSON.stringify(targets).includes('OLD_'))
})
test('A rebuild drops the old body, title, materials and assessments while retaining exact targets',()=>{
 const input=normalizeLessonInput({...base,preserveExisting:true},[]),payload=lessonGenerationInput(input)
 assert.equal(input.objectiveCount,2);assert.equal(payload.sourceLesson,'');assert.equal(payload.previousPlan,'')
 assert.equal(payload.lessonStyle,'problem');assert.equal(payload.creativeActivity,'roleplay')
 assert.ok(!JSON.stringify(payload).includes('OLD_'));assert.ok(!JSON.stringify(payload).includes('Old seminar title'))
 assert.ok(!JSON.stringify(payload).includes('Cup A'));assert.equal(payload.learningObjectives.length,2)
})
test('Retaining source material is opt-in and passes only the reviewed stimulus',()=>{
 const material=extractLessonStimulus(source)
 assert.equal(material,'Title: Water observations\nCup A loses 5 mL; covered cup B loses 1 mL.')
 const payload=lessonGenerationInput(normalizeLessonInput({...base,keepSourceMaterial:true},[]))
 assert.equal(payload.retainedSourceMaterial,material);assert.ok(!JSON.stringify(payload).includes('OLD_SEMINAR_STEPS'))
 const override=lessonGenerationInput(normalizeLessonInput({...base,keepSourceMaterial:true,retainedSourceMaterial:'Teacher-selected replacement dataset.'},[]))
 assert.equal(override.retainedSourceMaterial,'Teacher-selected replacement dataset.')
 assert.throws(()=>normalizeLessonInput({...base,sourceLesson:'Learning objectives\nExplain changes.',keepSourceMaterial:true},[]),/Paste the passage/)
})
test('Refresh continues to send the complete lesson for targeted improvement',()=>{
 const input=normalizeLessonInput({...base,startingPoint:'refresh',lessonStyle:'recommend'},[]),payload=lessonGenerationInput(input)
 assert.equal(payload.sourceLesson,source);assert.equal(payload.rebuildFromTargets,false)
})
test('Teacher targets across subjects work without official catalogue codes',()=>{
 for(const subject of ['music','math','history','science','reading']){
  const text=`Grade 6\nSubject: ${subject}\n45 minutes each\nObjectives\nCompare two examples using disciplinary evidence.\nProcedure\nOLD_TASK`
  const input=normalizeLessonInput({...base,sourceLesson:text,preserveExisting:true},[]),payload=lessonGenerationInput(input)
  assert.equal(input.standards[0].text,'Compare two examples using disciplinary evidence.')
  assert.deepEqual(payload.learningObjectives,['Compare two examples using disciplinary evidence.']);assert.ok(!JSON.stringify(payload).includes('OLD_TASK'))
 }
})
test('A natural-language conversion respects problem-based learning and role-play together',()=>{
 const result=requestedBehavior({lessonStyle:'recommend',creativeActivity:'group',previousPlan:source,revision:'Use problem-based learning with role-play.'})
 assert.equal(result.lessonStyle,'problem');assert.equal(result.creativeActivity,'roleplay');assert.equal(result.startingPoint,'convert')
})

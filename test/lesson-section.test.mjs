import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import {applySectionReplacement,sectionRewriteRequest,sectionRewriteSchema,sectionRewriteInstructions} from '../lib/lesson-section.mjs'
import {lessonOutputSections,planAsText} from '../lib/lesson-designer.mjs'
import {verifiedLessonEmail,LESSON_CONSENT_TEXT,LESSON_CONSENT_VERSION} from '../lib/lesson-access.mjs'
const input={state:'PA',grade:'7',subject:'science',minutes:45,sections:['Assessment'],standards:[{code:'TEST',text:'Use evidence.'}]}
const draft={input,plan:{title:'Science lesson',sections:[{heading:'Assessment',body:'Original assessment'}],alignment:[{code:'TEST',objective:'Explain',activity:'Experiment',assessment:'Observe'}],reviewNotes:['Check materials.'],displayEdits:{review:'Teacher custom review'}},worksheet:{title:'Old worksheet'}}
test('One rewrite preserves all other content and prior teacher edits; exports use the replacement',()=>{
 const before=structuredClone(draft),after=applySectionReplacement(draft,'section_0','New performance assessment')
 assert.deepEqual(draft,before)
 assert.deepEqual(after.plan.sections,before.plan.sections)
 assert.equal(after.plan.displayEdits.review,'Teacher custom review')
 assert.equal(after.worksheet,undefined)
 assert.equal(after.plan.title,before.plan.title)
 assert.equal(lessonOutputSections(after.plan,input).find(s=>s.key==='section_0').body,'New performance assessment')
 assert.match(planAsText(after.plan,input),/New performance assessment/)
 assert.doesNotMatch(planAsText(after.plan,input),/Original assessment/)
})
test('Official standards, invented section keys and empty changes are rejected',()=>{
 for(const key of ['standards','invented','__proto__'])assert.throws(()=>applySectionReplacement(draft,key,'Anything'))
 assert.throws(()=>applySectionReplacement(draft,'section_0',' '))
 assert.throws(()=>sectionRewriteRequest(draft.plan,input,'section_0',' '))
})
test('Rewrite context includes current manual edits across any subject',()=>{
 const request=sectionRewriteRequest(draft.plan,input,'section_0','Use an oral defense')
 assert.match(request.lesson,/Teacher custom review/);assert.equal(request.teacherDirections,'Use an oral defense');assert.equal(request.heading,'Assessment')
})
test('Verified email cannot be forged by user-editable metadata',()=>{
 assert.equal(verifiedLessonEmail({email:'test@example.com',user_metadata:{email_confirmed_at:'today',role:'teacher'}}),false)
 assert.equal(verifiedLessonEmail({email:'test@example.com',email_confirmed_at:'today'}),true)
 assert.equal(verifiedLessonEmail({email:'test@example.com',email_confirmed_at:'today',is_anonymous:true}),false)
})
function load(file,values){const source=readFileSync(new URL(file,import.meta.url),'utf8').replace(/^import .*\n/gm,'').replace(/export const /g,'const ').replace('export default async function handler','async function handler')+'\nthis.handler=handler';const context={process:{env:{OPENAI_API_KEY:'fake'}},console:{error(){}},AbortSignal,catalogue:[],...values};vm.createContext(context);vm.runInContext(source,context);return context.handler}
const res=()=>({setHeader(){},status(code){this.code=code;return this},json(data){this.data=data;return this}})
test('Section endpoint returns only a proposal and never makes an unauthorized provider call',async()=>{
 let calls=0
 const deps={requireLessonEducator:async()=>({user:{id:'teacher'}}),claimLessonRequest:async()=>true,normalizeLessonInput:x=>x,validateLessonPlan:x=>x,sectionRewriteRequest,sectionRewriteSchema,sectionRewriteInstructions,fetch:async()=>{calls++;return {ok:true,json:async()=>({output_text:JSON.stringify({body:'New task',reviewNote:'Review alignment.'})})}}}
 const run=load('../pages/api/lessonplan/section.js',deps),response=res()
 await run({method:'POST',body:{input,plan:draft.plan,sectionKey:'section_0',directions:'Use a demonstration.'}},response)
 assert.equal(response.data.body,'New task');assert.equal(response.data.plan,undefined);assert.equal(calls,1)
 const denied=load('../pages/api/lessonplan/section.js',{...deps,requireLessonEducator:async()=>({status:401,error:'Sign in'})}),r=res()
 await denied({method:'POST',body:{}},r);assert.equal(r.code,401);assert.equal(calls,1)
})
test('Provider failure leaves the selected section unchanged',async()=>{
 const run=load('../pages/api/lessonplan/section.js',{requireLessonEducator:async()=>({user:{id:'teacher'}}),claimLessonRequest:async()=>true,normalizeLessonInput:x=>x,validateLessonPlan:x=>x,sectionRewriteRequest,sectionRewriteSchema,sectionRewriteInstructions,fetch:async()=>({ok:false,json:async()=>({})})}),r=res()
 await run({method:'POST',body:{input,plan:draft.plan,sectionKey:'section_0',directions:'Try another task'}},r)
 assert.equal(r.code,502);assert.equal(draft.plan.sections[0].body,'Original assessment')
})

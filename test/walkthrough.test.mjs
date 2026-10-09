import test from 'node:test'
import assert from 'node:assert/strict'
import {walkthroughInput,lookForSuggestions,combineSuggestions,cleanTopic,teacherFeedbackEmail,LOOK_FORS} from '../lib/walkthrough.mjs'
const id='0b3c6a4e-1111-4222-8333-944455556666'
test('walkthrough needs a teacher, strength, and next step',()=>{
 assert.throws(()=>walkthroughInput({}),/teacher/)
 assert.throws(()=>walkthroughInput({staffId:id,strength:'Great'}),/next step/)
 const w=walkthroughInput({staffId:id,strength:'Clear modeling',nextStep:'Add a quick check',ratings:{objective:3,engagement:1},followUp:'Other',followUpOther:'Visit Tuesday'})
 assert.equal(w.followUp,'Other: Visit Tuesday')
})
test('only Emerging becomes a suggestion, never Not observed',()=>{
 const s=lookForSuggestions({objective:0,engagement:1,cfu:2})
 assert.deepEqual(s.map(x=>x.topic),[LOOK_FORS.find(f=>f.key==='engagement').topic])
})
test('next step topic leads, max three, no duplicates',()=>{
 const out=combineSuggestions(lookForSuggestions({engagement:1,cfu:1,questioning:1,data:1}),cleanTopic('"Using exit tickets to adjust instruction."'))
 assert.equal(out.length,3);assert.equal(out[0].topic,'Using exit tickets to adjust instruction')
})
test('teacher email never includes private notes',()=>{
 const m=teacherFeedbackEmail({teacherName:'Karen Green',observerName:'Rob Furman',ratings:{objective:3},strength:'S',nextStep:'N',sharedFeedback:'',privateNotes:'SECRET'})
 assert.match(m.body,/^Hi Karen,/);assert.doesNotMatch(m.body,/SECRET/);assert.match(m.body,/strongly evident/)
})

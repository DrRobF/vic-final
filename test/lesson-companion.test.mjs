import test from 'node:test'
import assert from 'node:assert/strict'
import {companionInput,companionInstructions,COMPANION_TOOLS,vicTargetText,familyFallback,nextFallback} from '../lib/lesson-companion.mjs'

test('lesson tools accept a saved-lesson workflow without retyping notes',()=>{
 for(const kind of ['prep','family','vic'])assert.deepEqual(companionInput({kind,notes:''}),{kind,notes:''})
 assert.equal(Object.keys(COMPANION_TOOLS).length,4)
})
test('next-day adjustment accepts an optional observation, and kind is bounded',()=>{
 assert.deepEqual(companionInput({kind:'next',notes:''}),{kind:'next',notes:''})
 assert.deepEqual(companionInput({kind:'next',notes:'Students needed more practice.'}),{kind:'next',notes:'Students needed more practice.'})
 assert.throws(()=>companionInput({kind:'grades',notes:'Anything'}),/Choose/)
 assert.match(companionInstructions('family'),/Never name students/)
})
test('VIC receives only the saved standard and objectives; family and next drafts remain editable',()=>{
 const lesson={input:{standards:[{code:'MA.3',text:'Use equal groups'}],topic:'Arrays'},plan:{title:'Array lesson',objectives:[{statement:'Students will model multiplication with arrays.'}],sections:[{heading:'Teaching and modeling',body:'Do not transfer this teacher plan.'}]}}
 const target=vicTargetText(lesson)
 assert.match(target,/MA\.3: Use equal groups/)
 assert.match(target,/Students will model multiplication with arrays/)
 assert.doesNotMatch(target,/Do not transfer/)
 assert.match(familyFallback(lesson),/Conversation starter/)
 assert.match(nextFallback(lesson),/Suggested next-day/)
})

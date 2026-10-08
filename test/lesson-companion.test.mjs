import test from 'node:test'
import assert from 'node:assert/strict'
import {companionInput,companionInstructions,COMPANION_TOOLS} from '../lib/lesson-companion.mjs'

test('lesson tools accept a saved-lesson workflow without retyping notes',()=>{
 for(const kind of ['prep','family','vic'])assert.deepEqual(companionInput({kind,notes:''}),{kind,notes:''})
 assert.equal(Object.keys(COMPANION_TOOLS).length,4)
})
test('next-day adjustment needs teacher observations, and kind is bounded',()=>{
 assert.throws(()=>companionInput({kind:'next',notes:'short'}),/10 characters/)
 assert.deepEqual(companionInput({kind:'next',notes:'Students needed more practice.'}),{kind:'next',notes:'Students needed more practice.'})
 assert.throws(()=>companionInput({kind:'grades',notes:'Anything'}),/Choose/)
 assert.match(companionInstructions('family'),/Never name students/)
})

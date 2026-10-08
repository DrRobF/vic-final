import test from 'node:test'
import assert from 'node:assert/strict'
import {letterInputs,validParentEmail,fallbackLetter,LETTER_STATEMENTS} from '../lib/parent-letter.mjs'

test('selected parent-letter inputs are bounded and require a source',()=>{
 assert.throws(()=>letterInputs({}),/source/)
 assert.deepEqual(letterInputs({statements:['joy','joy'],notes:'  Student asked a question. '}),{includeVic:false,includeVicReport:false,lessonIds:[],statements:['joy'],notes:'Student asked a question.',classNote:''})
 assert.throws(()=>letterInputs({statements:['unselected']}),/statements/)
 assert.equal(Object.hasOwn(LETTER_STATEMENTS,'routines'),true)
})
test('fallback uses only selected child context and checks recipient format',()=>{
 const message=fallbackLetter({name:'Ana Rivera',lessons:[{title:'Fractions',objectives:['Compare unit fractions']}],statements:[],notes:'Ana asked for an extra example.',classNote:'',vic:[]})
 assert.match(message.body,/Ana asked for an extra example/)
 assert.match(message.body,/Compare unit fractions/)
 assert.doesNotMatch(message.body,/VIC/)
 assert.equal(validParentEmail('parent@example.org'),true)
 assert.equal(validParentEmail('not-an-email'),false)
})

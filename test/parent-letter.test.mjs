import test from 'node:test'
import assert from 'node:assert/strict'
import {letterInputs,validParentEmail,fallbackLetter,LETTER_STATEMENTS,includeAtHomeActivity,signTeacherLetter} from '../lib/parent-letter.mjs'

test('selected parent-letter inputs are bounded and require a source',()=>{
 assert.throws(()=>letterInputs({}),/source/)
 assert.deepEqual(letterInputs({statements:['joy','joy'],notes:'  Student asked a question. '}),{includeVic:false,includeVicReport:false,lessonIds:[],familyIds:[],statements:['joy'],notes:'Student asked a question.',classNote:''})
 assert.throws(()=>letterInputs({statements:['unselected']}),/statements/)
 assert.equal(Object.hasOwn(LETTER_STATEMENTS,'routines'),true)
})
test('fallback uses only selected child context and checks recipient format',()=>{
 const message=fallbackLetter({name:'Ana Rivera',lessons:[{title:'Fractions',objectives:['Compare unit fractions']}],statements:[],notes:'Ana asked for an extra example.',classNote:'',vic:[]})
 assert.match(message.body,/Ana asked for an extra example/)
 assert.match(message.body,/Compare unit fractions/)
 assert.doesNotMatch(message.body,/VIC/)
 const personalized=fallbackLetter({name:'Ana Rivera',lessons:[],statements:[LETTER_STATEMENTS.joy],notes:'',classNote:'',vic:[]})
 assert.match(personalized.body,/A delight to have in class/)
 assert.doesNotMatch(personalized.body,/staying focused/)
 assert.equal(validParentEmail('parent@example.org'),true)
 assert.equal(validParentEmail('not-an-email'),false)
})

test('every generated letter gains a parent-child activity tied to a chosen goal',()=>{
 const reading=includeAtHomeActivity({subject:'Update',body:'A learning update.'},{name:'Jake Adams',lessons:[{objectives:['Describe how a character changes in a story']}],familyUpdates:[]})
 assert.match(reading.body,/At-home activity: Read a short passage/)
 assert.match(reading.body,/Jake/)
 assert.match(reading.body,/character changes/)
 const generic=includeAtHomeActivity({subject:'Update',body:'An update.'},{name:'Sally Jones',lessons:[],familyUpdates:[]})
 assert.match(generic.body,/Sally/)
 assert.match(generic.body,/At-home activity:/)
 assert.doesNotMatch(generic.body,/Jake/)
})

test('teacher signature uses account name in new letters',()=>{
 const letter=signTeacherLetter({subject:'Hello',body:'Warmly,\n[Teacher\'s Name]'},'Alex Rivera')
 assert.match(letter.body,/Alex Rivera/)
 assert.doesNotMatch(letter.body,/\[Teacher\'s Name\]/)
 assert.equal(letter.body.match(/Alex Rivera/g).length,1)
 const fresh=signTeacherLetter({subject:'Hello',body:'A parent update.\n\nAt-home activity: Read together.'},'Alex Rivera')
 assert.match(fresh.body,/At-home activity:[\s\S]*Warmly,\nAlex Rivera$/)
})

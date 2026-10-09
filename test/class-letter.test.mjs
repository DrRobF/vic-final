import test from 'node:test'
import assert from 'node:assert/strict'
import {classLetterInputs,CLASS_LETTER_INSTRUCTIONS,fallbackClassLetter} from '../lib/class-letter.mjs'

test('class letter needs at least one source',()=>{
 assert.throws(()=>classLetterInputs({}),/Choose a lesson/)
 assert.deepEqual(classLetterInputs({note:'Field trip Friday, wear sneakers'}).note,'Field trip Friday, wear sneakers')
})
test('class letter never singles out a student',()=>{
 assert.match(CLASS_LETTER_INSTRUCTIONS,/never name/)
 const l=fallbackClassLetter({note:'Picture day is Tuesday.'})
 assert.match(l.body,/^Dear Families,/)
 assert.match(l.body,/Picture day is Tuesday\./)
})

test('saved family reminders feed the class letter',()=>{
 const input=classLetterInputs({reminders:['Book report due (Friday, October 16)']})
 assert.equal(input.reminders.length,1)
 const l=fallbackClassLetter({reminders:input.reminders})
 assert.match(l.body,/Book report due \(Friday, October 16\)/)
})

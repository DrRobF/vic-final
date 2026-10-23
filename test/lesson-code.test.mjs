import test from 'node:test'
import assert from 'node:assert/strict'
import {codeRequest} from '../lib/lesson-code.mjs'

test('A typed address and code come back tidied',()=>{
 assert.deepEqual(codeRequest({email:'  Teacher@Example.COM ',code:' 123456 '}),{email:'teacher@example.com',code:'123456'})
})
test('A school alias address is accepted like any other',()=>{
 assert.deepEqual(codeRequest({email:'rfurman@saintpetersacademy.org',code:'654321'}),{email:'rfurman@saintpetersacademy.org',code:'654321'})
})
test('Codes that are not digits are refused before any lookup',()=>{
 for(const code of ['','12345','abcdef','123 456','12345678901','123456; drop'])
  assert.throws(()=>codeRequest({email:'teacher@example.com',code}),/verification code/)
})
test('A missing or malformed address is refused',()=>{
 for(const email of [undefined,'','teacher','teacher@','@example.com','a'.repeat(250)+'@example.com'])
  assert.throws(()=>codeRequest({email,code:'123456'}),/valid email/)
})

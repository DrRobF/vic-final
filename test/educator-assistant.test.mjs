import test from 'node:test'
import assert from 'node:assert/strict'
import {ASSISTANT_TOOLS,assistantInput,assistantInstructions} from '../lib/educator-assistant.mjs'

test('parent email from notes is the first assistant tool',()=>{
 assert.equal(Object.keys(ASSISTANT_TOOLS)[0],'parent_email')
 assert.match(ASSISTANT_TOOLS.parent_email.label,/Parent email/)
})

test('parent email accepts quick notes and keeps the no-invention rules',()=>{
 const input=assistantInput({kind:'parent_email',notes:'missing 3 homework, great effort in reading group'})
 assert.equal(input.kind,'parent_email')
 const text=assistantInstructions('parent_email')
 assert.match(text,/\[Student\]/)
 assert.match(text,/Subject:/)
 assert.match(text,/Do not invent grades/)
})

test('tasks keep the For families flag',async()=>{
 const {assistantTasks}=await import('../lib/educator-assistant.mjs')
 const [t]=assistantTasks([{title:'Remind families: picture day',due:'2026-10-16',family:true}])
 assert.equal(t.family,true)
 assert.equal(assistantTasks([{title:'Grade quizzes'}])[0].family,false)
})

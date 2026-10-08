import test from 'node:test'
import assert from 'node:assert/strict'
import {buildLessonPacket,validatePacket,studentAssessment} from '../lib/lesson-packet.mjs'

test('packet uses saved teaching kit and keeps teacher answers out of student pages',()=>{
 const draft={input:{topic:'Character development',standards:[{code:'RL.3',text:'Describe a character'}]},plan:{title:'Brave Explorer',objectives:[{statement:'Students will explain a character change.'}],sections:[{heading:'Materials and preparation',body:'Passage and cards'}],teachingKit:{sourceMaterial:'The Brave Little Explorer\nOnce upon a time...',studentTask:'Character map\nName: ____\nEvidence: ____\nPeer checklist: ____',supports:'1. Support group\nSupplied support / extension material:\nSentence starter: The character changed because...\nHow to use it: Teacher models aloud.',assessment:'Directions: Explain.\n\n1. What changed?\nTeacher sample response / acceptable evidence: She learned courage.\nSuccess criteria: Quote evidence.',teacherModel:'Model using page 1.',discussionGuide:'Question and response.'}},worksheet:{versions:[{label:'Practice',directions:'Read and answer.',passage:'',questions:[{prompt:'Why?',answer:'Because.'}]}]}}
 const packet=buildLessonPacket(draft)
 assert.match(packet.student.map(s=>s.body).join('\n'),/Brave Little Explorer/)
 assert.match(packet.student.map(s=>s.body).join('\n'),/What changed\?/)
 assert.doesNotMatch(packet.student.map(s=>s.body).join('\n'),/She learned courage|Because\./)
 assert.match(packet.teacher.map(s=>s.body).join('\n'),/Because\./)
 assert.match(packet.supports[0].body,/Sentence starter/)
 assert.doesNotMatch(packet.supports[0].body,/Teacher models aloud/)
 assert.equal(validatePacket(packet).student.length>0,true)
})
test('assessment extracts prompts without sample answers',()=>{
 assert.equal(studentAssessment('Directions: Read\n\n1. Prompt\nTeacher sample response / acceptable evidence: Secret\nSuccess criteria: Detail.'),'1. Prompt')
})

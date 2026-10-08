import test from 'node:test'
import assert from 'node:assert/strict'
import {studentAccountInput,mayEnroll,searchTerms} from '../lib/single-account.mjs'
test('student input normalizes login and deduplicates classroom choices',()=>{
 assert.deepEqual(studentAccountInput({name:'  Ava  Walker ',username:'AvaWalker',classIds:[33,34,33]}),{name:'Ava Walker',username:'avawalker',email:'avawalker@students.askvic.ai',classIds:[33,34]})
 for(const username of ['x','bad@email.com','bad,filter','../escape']) assert.throws(()=>studentAccountInput({name:'Student',username}))
 assert.throws(()=>studentAccountInput({name:'Student',username:'student',classIds:['33']}))
})
test('classroom enrollment requires owner or approved administrator',()=>{
 const owner={profile:{id:89,role:'teacher'}},other={profile:{id:90,role:'teacher'}},student={profile:{id:123,role:'student'}}
 assert.equal(mayEnroll(owner,{teacher_id:89},false),true)
 assert.equal(mayEnroll(other,{teacher_id:89},false),false)
 assert.equal(mayEnroll(other,{teacher_id:89},true),true)
 assert.equal(mayEnroll(student,{teacher_id:89},true),false)
 assert.equal(mayEnroll(owner,null,true),false)
})
test('name searches support middle names while stripping query operators',()=>{
 assert.deepEqual(searchTerms('John Louis'),['John','Louis'])
 assert.deepEqual(searchTerms('Florencia chandelier Pierre'),['Florencia','chandelier','Pierre'])
 assert.deepEqual(searchTerms('Jake),role.eq.teacher'),['Jake','role.eq.teacher'])
 assert.throws(()=>searchTerms('%'))
})

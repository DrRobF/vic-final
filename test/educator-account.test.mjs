import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {educatorDestination,accountPatch,canManageAccounts,schoolEducator,studentProfile} from '../lib/educator-account.mjs'
test('Shared educator destinations cannot redirect outside the site or into student routes',()=>{
 for(const target of ['https://evil.example','//evil.example','/student','/student-login','/askvic?studentId=2',null])assert.equal(educatorDestination(target),'/educator')
 for(const target of ['/lessonplan','/teacher','/admin/accounts'])assert.equal(educatorDestination(target),target)
})
test('Account permissions require both authenticated administrator identity and approved profile',()=>{
 const email='admin@example.com',auth={user:{email},profile:{email,role:'teacher'}}
 assert.equal(canManageAccounts(auth,email),true)
 assert.equal(canManageAccounts({...auth,user:{email:'other@example.com'}},email),false)
 assert.equal(canManageAccounts({...auth,profile:{email,role:'student'}},email),false)
 assert.equal(canManageAccounts({...auth,profile:{email:'other@example.com',role:'teacher'}},email),false)
 assert.equal(schoolEducator({role:'student'}),false);assert.equal(studentProfile({role:'student'}),true)
})
test('Single-person changes validate fields without allowing role, email or authentication changes',()=>{
 const student={id:2,role:'student'}
 assert.deepEqual(accountPatch({id:2,name:'  A  Student ',parentEmail:' P@Example.com ',interestTags:'music, science'},student),{name:'A Student',parent_email:'p@example.com',interest_tags:['music','science']})
 for(const key of ['role','email','auth_user_id','password'])assert.throws(()=>accountPatch({id:2,name:'Name',[key]:'changed'},student),/protected/)
 assert.throws(()=>accountPatch({id:3,name:'Name'},student),/valid account/)
 assert.throws(()=>accountPatch({id:2,name:'Name',parentEmail:'bad'},student),/valid parent/)
 assert.throws(()=>accountPatch({id:8,name:'Teacher',interestTags:'x'},{id:8,role:'teacher'}),/only.*student/)
})
function loadAccounts(auth,admin){
 const source=fs.readFileSync(new URL('../pages/api/admin/accounts.js',import.meta.url),'utf8').replace(/^import .*\n/gm,'').replace('export const config=','const config=').replace('export default async function handler','async function handler')+'\nhandler'
 return vm.runInNewContext(source,{requireApprovedProfile:async()=>({...auth,admin}),ADMIN_EMAIL:'admin@example.com',accountPatch,canManageAccounts})
}
function response(){return {code:200,body:null,setHeader(){},status(n){this.code=n;return this},json(v){this.body=v;return this}}}
test('Unauthorized and student callers cannot list or mutate school accounts',async()=>{
 let calls=0;const admin={from(){calls++;throw Error('must not query')}}
 for(const auth of [{error:'Missing token',status:401},{user:{email:'admin@example.com'},profile:{email:'admin@example.com',role:'student'}},{user:{email:'other@example.com'},profile:{email:'other@example.com',role:'teacher'}}]){
  for(const method of ['GET','PATCH']){const res=response();await loadAccounts(auth,admin)({method,query:{},body:{id:2,name:'Change'}},res);assert.ok([401,403].includes(res.code))}
 }
 assert.equal(calls,0)
})
test('Individual edit targets exactly one verified row and never touches Auth or other roles',async()=>{
 const auth={user:{email:'admin@example.com'},profile:{email:'admin@example.com',role:'teacher'}},events=[]
 const profile={id:2,name:'Old',role:'student'}
 const admin={from(table){assert.equal(table,'users');let patch;return {select(){return this},eq(k,v){events.push([k,v]);return this},update(p){patch=p;events.push(['patch',p]);return this},async maybeSingle(){return {data:patch?{...profile,...patch}:profile}}}}}
 const res=response();await loadAccounts(auth,admin)({method:'PATCH',body:{id:2,name:'New',parentEmail:'',interestTags:'music'},query:{}},res)
 assert.equal(res.code,200);assert.equal(res.body.account.name,'New');assert.deepEqual(events,[['id',2],['patch',{name:'New',parent_email:null,interest_tags:['music']}],['id',2],['role','student']])
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {accountAction,accountUnavailable,classroomPatch,enrollmentAction} from '../lib/admin-management.mjs'
import {canManageAccounts} from '../lib/educator-account.mjs'
const actor={user:{id:'administrator',email:'admin@example.com'},profile:{id:1,email:'admin@example.com',role:'teacher'}}
test('Account changes require an exact target confirmation and protect the administrator',()=>{
 const profile={id:2,role:'student',auth_user_id:'student'}
 assert.equal(accountAction({id:2,action:'reset-password',confirm:'reset-password:2',password:'new-password'},profile,actor).action,'reset-password')
 for(const body of [{id:2,action:'archive',confirm:'archive:3'},{id:2,action:'reset-password',confirm:'reset-password:2',password:'short'},{id:2,action:'delete'}])assert.throws(()=>accountAction(body,profile,actor))
 assert.throws(()=>accountAction({id:1,action:'archive',confirm:'archive:1'},{...actor.profile,auth_user_id:actor.user.id},actor),/administrator account/)
 assert.throws(()=>accountAction({id:2,action:'restore',confirm:'restore:2'},profile,actor),/already active/)
})
test('Disabled accounts are rejected from fresh server-verified metadata and bans',()=>{
 assert.equal(accountUnavailable({app_metadata:{account_disabled:true}}),true)
 assert.equal(accountUnavailable({banned_until:'2099-01-01T00:00:00Z'}),true)
 assert.equal(accountUnavailable({app_metadata:{account_disabled:false},banned_until:'2020-01-01T00:00:00Z'}),false)
 assert.equal(accountUnavailable({user_metadata:{account_disabled:true}}),false)
})
test('Classroom creation supports Kindergarten, all grades and a selected teacher',()=>{
 assert.deepEqual(classroomPatch({teacherId:7,name:'  Reading ',grade:'K'}),{teacher_id:7,class_name:'Reading',grade_level:0})
 assert.deepEqual(classroomPatch({teacherId:7,name:'Science',grade:'8'}),{teacher_id:7,class_name:'Science',grade_level:8})
 for(const body of [{teacherId:0,name:'Class'},{teacherId:7,name:''},{teacherId:7,name:'Class',grade:13}])assert.throws(()=>classroomPatch(body))
})
test('Class roster removal is scoped to one classroom and confirmed student',()=>{
 assert.deepEqual(enrollmentAction({classId:4,studentId:2,action:'add'}),{classId:4,studentId:2,action:'add'})
 assert.throws(()=>enrollmentAction({classId:4,studentId:2,action:'remove',confirm:'remove:5:2'}),/Confirm/)
 assert.deepEqual(enrollmentAction({classId:4,studentId:2,action:'remove',confirm:'remove:4:2'}),{classId:4,studentId:2,action:'remove'})
})
function handler(file,auth,admin){
 const source=fs.readFileSync(new URL('../pages/api/admin/'+file+'.js',import.meta.url),'utf8').replace(/^import .*\n/gm,'').replace('export const config=','const config=').replace('export default async function handler','async function handler')+'\nhandler'
 return vm.runInNewContext(source,{Date,requireApprovedProfile:async()=>({...auth,admin}),ADMIN_EMAIL:'admin@example.com',canManageAccounts,accountAction,classroomPatch,enrollmentAction})
}
function response(){return {code:200,body:null,setHeader(){},status(n){this.code=n;return this},json(v){this.body=v;return this}}}
test('All account and classroom operations reject unauthorized callers before database access',async()=>{
 let calls=0;const admin={from(){calls++;throw Error('blocked')}}
 for(const who of [{error:'No login',status:401},{user:{email:'student@example.com'},profile:{email:'student@example.com',role:'student'}},{user:{email:'teacher@example.com'},profile:{email:'teacher@example.com',role:'teacher'}}]){
  for(const [file,methods] of [['account-actions',['POST']],['classrooms',['GET','POST','PATCH','PUT']]])for(const method of methods){const res=response();await handler(file,who,admin)({method,query:{},body:{}},res);assert.ok([401,403].includes(res.code))}
 }
 assert.equal(calls,0)
})
test('Password reset verifies the exact linked login, preserves metadata, and never returns the password',async()=>{
 const target={id:2,name:'Student',email:'s@example.com',role:'student',auth_user_id:'student'},calls=[]
 const admin={from(){return {select(){return this},eq(k,v){calls.push(['filter',k,v]);return this},async maybeSingle(){return {data:target}},then(resolve){resolve({data:[{id:2}]})}}},auth:{admin:{async getUserById(id){assert.equal(id,'student');return {data:{user:{id,email:target.email,app_metadata:{existing:'kept'}}}}},async updateUserById(id,patch){calls.push(['auth',id,patch]);return {data:{user:{id}},error:null}}}}}
 const res=response();await handler('account-actions',actor,admin)({method:'POST',body:{id:2,action:'reset-password',confirm:'reset-password:2',password:'new-password'}},res)
 assert.equal(res.code,200);assert.equal(res.body.success,true);assert.equal(JSON.stringify(res.body).includes('new-password'),false)
 const patch=calls.find(r=>r[0]==='auth')[2];assert.equal(patch.password,'new-password');assert.equal(patch.app_metadata.existing,'kept');assert.equal(patch.app_metadata.must_change_password,false)
})
test('Removing a student deletes only the requested enrollment, preserving the account and assignments',async()=>{
 const calls=[];const admin={from(table){calls.push(['table',table]);return {select(){return this},eq(k,v){calls.push(['filter',k,v]);return this},async maybeSingle(){return {data:table==='classes'?{id:4}:{id:2,role:'student'}}},delete(){calls.push(['delete',table]);return this},then(resolve){resolve({error:null})}}}}
 const res=response();await handler('classrooms',actor,admin)({method:'PUT',body:{classId:4,studentId:2,action:'remove',confirm:'remove:4:2'}},res)
 assert.equal(res.code,200);assert.deepEqual(calls.filter(r=>r[0]==='delete'),[['delete','enrollments']]);assert.deepEqual(calls.slice(-2),[['filter','class_id',4],['filter','student_id',2]])
 assert.equal(calls.some(r=>r[1]==='assignments'||r[1]==='sessions'),false)
})
test('Account removal archives the profile and disables access without deleting saved work',async()=>{
 const target={id:2,name:'Student',email:'s@example.com',role:'student',auth_user_id:'student'},calls=[]
 const admin={from(){let patch;return {select(){return this},eq(){return this},update(p){patch=p;calls.push(['profile',p]);return this},async maybeSingle(){return {data:patch?{...target,...patch}:target}},then(resolve){resolve({data:[{id:2}]})}}},auth:{admin:{async getUserById(id){return {data:{user:{id,email:target.email,app_metadata:{existing:'kept'}}}}},async updateUserById(id,patch){calls.push(['auth',patch]);return {error:null}}}}}
 const res=response();await handler('account-actions',actor,admin)({method:'POST',body:{id:2,action:'archive',confirm:'archive:2'}},res)
 assert.equal(res.code,200);assert.equal(res.body.account.role,'archived');assert.equal(calls[0][1].app_metadata.account_disabled,true);assert.equal(calls[0][1].app_metadata.archived_school_role,'student');assert.equal(calls[1][0],'profile');assert.equal(calls[1][1].role,'archived');assert.equal(calls.some(r=>r[0]==='delete'),false)
})
test('Restore only uses the original role from server-controlled metadata',async()=>{
 const target={id:2,name:'Student',email:'s@example.com',role:'archived',auth_user_id:'student'},calls=[]
 const admin={from(){let patch;return {select(){return this},eq(){return this},update(p){patch=p;calls.push(['profile',p]);return this},async maybeSingle(){return {data:patch?{...target,...patch}:target}},then(resolve){resolve({data:[{id:2}]})}}},auth:{admin:{async getUserById(id){return {data:{user:{id,email:target.email,app_metadata:{archived_school_role:'student',account_disabled:true},user_metadata:{archived_school_role:'teacher'}}}}},async updateUserById(id,patch){calls.push(['auth',patch]);return {error:null}}}}}
 const res=response();await handler('account-actions',actor,admin)({method:'POST',body:{id:2,action:'restore',confirm:'restore:2'}},res)
 assert.equal(res.code,200);assert.equal(res.body.account.role,'student');assert.equal(calls[0][0],'profile');assert.equal(calls[0][1].role,'student');assert.equal(calls[1][1].ban_duration,'none');assert.equal(calls[1][1].app_metadata.account_disabled,false)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {createHash} from 'node:crypto'
import {staffRows} from '../lib/staff-setup.mjs'
import {accountUnavailable} from '../lib/admin-management.mjs'
import {canManageAccounts} from '../lib/educator-account.mjs'
const adminEmail='admin@example.com',actor={user:{id:'admin',email:adminEmail},profile:{id:1,email:adminEmail,role:'teacher'}}
function handler(auth,admin){const source=fs.readFileSync(new URL('../pages/api/admin/create-staff.js',import.meta.url),'utf8').replace(/^import .*\n/gm,'').replace('export const config=','const config=').replace('export default async function handler','async function handler')+'\nhandler';return vm.runInNewContext(source,{Date,createHash,requireApprovedProfile:async()=>({...auth,admin}),ADMIN_EMAIL:adminEmail,canManageAccounts,accountUnavailable,staffRows})}
function response(){return {code:200,setHeader(){},status(n){this.code=n;return this},json(d){this.body=d;return this}}}
test('Staff setup validates exact people without granting administrator roles or changing the owner',()=>{
 assert.equal(staffRows([{name:' Julie ',email:' JULIE@Example.com '}],adminEmail)[0].email,'julie@example.com')
 for(const rows of [[],[{name:'Rob',email:adminEmail}],[{name:'Staff',email:'bad'}],[{name:'Staff',email:'staff@example.com',role:'principal'}],[{name:'A',email:'a@example.com'},{name:'B',email:'A@example.com'}]])assert.throws(()=>staffRows(rows,adminEmail))
})
test('Staff preview and apply require the approved administrator before reading any accounts',async()=>{
 let calls=0;const admin={from(){calls++;throw Error('blocked')},auth:{admin:{listUsers(){calls++;throw Error('blocked')}}}}
 for(const who of [{error:'No login',status:401},{user:{email:'staff@example.com'},profile:{email:'staff@example.com',role:'teacher'}},{...actor,profile:{...actor.profile,role:'student'}}])for(const mode of ['preview','apply']){const res=response();await handler(who,admin)({method:'POST',body:{mode,rows:[{name:'Julie',email:'julie@example.com'}]}},res);assert.ok([401,403].includes(res.code))}
 assert.equal(calls,0)
})
test('Staff creation requires the current reviewed plan, sends no email, and preserves existing passwords',async()=>{
 const calls=[],profiles=[],users=[]
 const admin={auth:{admin:{async listUsers(){return {data:{users}}},async createUser(row){calls.push(['create',row]);users.push({id:'new-login',email:row.email});return {data:{user:users[0]}}}}},from(){let patch;return {select(){return this},limit(){return Promise.resolve({data:profiles})},insert(p){patch=p;calls.push(['profile',p]);return this},async single(){profiles.push({id:2,...patch});return {data:{id:2}}}}}}
 const rows=[{name:'Julie Murphy',email:'julie@example.com'}],run=handler(actor,admin)
 let res=response();await run({method:'POST',body:{mode:'preview',rows}},res);const confirmation=res.body.confirmation;assert.equal(calls.length,0)
 res=response();await run({method:'POST',body:{mode:'apply',rows,confirmation:'old-plan'}},res);assert.equal(res.code,409);assert.equal(calls.length,0)
 res=response();await run({method:'POST',body:{mode:'apply',rows,confirmation}},res);assert.equal(res.code,200);assert.equal(res.body.complete,true);assert.equal(calls[0][1].email_confirm,false);assert.equal(calls[0][1].password,undefined);assert.equal(calls[1][1].role,'teacher');assert.equal(calls[1][1].auth_user_id,'new-login')
})

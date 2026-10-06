import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFileSync} from 'node:fs'
import {verifiedLessonEmail,LESSON_CONSENT_TEXT,LESSON_CONSENT_VERSION} from '../lib/lesson-access.mjs'
function load(user,stored,save){const src=readFileSync(new URL('../pages/api/lessonplan/access.js',import.meta.url),'utf8').replace(/^import .*\n/gm,'').replace('export default async function handler','async function handler')+'\nthis.handler=handler';const context={Date,console:{error(){}},process:{env:{LESSON_PUBLIC_SIGNUP_ENABLED:'true',NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'server'}},readBearerToken:req=>req.headers?.authorization,verifiedLessonEmail,LESSON_CONSENT_TEXT,LESSON_CONSENT_VERSION,createClient:()=>({auth:{getUser:async()=>({data:{user},error:null})},from:table=>{assert.equal(table,'lesson_memberships');return {select(){return this},eq(){return this},maybeSingle:async()=>({data:stored,error:null}),upsert:async value=>{save.push(value);return {error:null}},update(value){save.push(value);return this},then(resolve){resolve({error:null})}}}})};vm.createContext(context);vm.runInContext(src,context);return {run:context.handler,context}}
const res=()=>({setHeader(){},status(code){this.code=code;return this},json(data){this.data=data;return this}})
const user={id:'educator',email:'teacher@example.com',email_confirmed_at:'2026-10-06'}
test('Enrollment requires verified account, explicit consent and adult confirmation',async()=>{
 for(const [who,body,expected] of [[user,{adultEducator:true},400],[user,{consent:true},400],[{...user,email_confirmed_at:null,user_metadata:{email_confirmed_at:'yes'}},{consent:true,adultEducator:true},403]]){const saves=[],{run}=load(who,null,saves),r=res();await run({method:'POST',headers:{authorization:'token'},body},r);assert.equal(r.code,expected);assert.equal(saves.length,0)}
})
test('Enrollment records server-verified email and consent wording, never a school role',async()=>{
 const saves=[],{run}=load(user,null,saves),r=res();await run({method:'POST',headers:{authorization:'token'},body:{consent:true,adultEducator:true,email:'forged@example.com',role:'principal'}},r)
 assert.equal(r.data.success,true);assert.equal(saves[0].email,user.email);assert.equal(saves[0].consent_text,LESSON_CONSENT_TEXT);assert.equal(saves[0].role,undefined)
})
test('Signup stays disabled until explicitly enabled; unsubscribe remains available',async()=>{
 const saves=[],{run,context}=load(user,{newsletter_consent:true},saves);context.process.env.LESSON_PUBLIC_SIGNUP_ENABLED='false';let r=res();await run({method:'POST',headers:{authorization:'token'},body:{consent:true,adultEducator:true}},r);assert.equal(r.code,503);assert.equal(saves.length,0)
 r=res();await run({method:'POST',headers:{authorization:'token'},body:{unsubscribe:true}},r);assert.equal(r.data.success,true);assert.equal(saves[0].newsletter_consent,false);assert.equal(saves[0].user_id,undefined)
})

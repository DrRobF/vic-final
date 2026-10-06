import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import {createHash} from 'node:crypto'
import {LESSON_CONSENT_TEXT,LESSON_CONSENT_VERSION} from '../lib/lesson-access.mjs'
import {lessonSignupEnabled,signupEmail,lessonSigninLink} from '../lib/lesson-signup.mjs'
const env={RESEND_API_KEY:'fake',REPORTS_FROM_EMAIL:'VIC <reports@example.com>',SUPABASE_SERVICE_ROLE_KEY:'private',NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public'}
function load(allowed=true,sent=true){let messages=[],links=0;const src=readFileSync(new URL('../pages/api/lessonplan/email.js',import.meta.url),'utf8').replace(/^import .*\n/gm,'').replace('export const ','const ').replace('export default async function handler','async function handler')+'\nthis.handler=handler';const context={console:{error(){}},AbortSignal,process:{env},createHash,LESSON_CONSENT_TEXT,LESSON_CONSENT_VERSION,lessonSignupEnabled,signupEmail,lessonSigninLink,createClient:()=>({from:()=>({upsert:async()=>({error:null})}),rpc:async()=>({data:allowed,error:null}),auth:{admin:{generateLink:async()=>{links++;return {data:{user:{id:'teacher'},properties:{hashed_token:'private-token',verification_type:'signup'}},error:null}}}}}),fetch:async(url,options)=>{messages.push(JSON.parse(options.body));return {ok:sent,status:sent?200:503,json:async()=>sent?{id:'delivery'}:{}}}};vm.createContext(context);vm.runInContext(src,context);return {run:context.handler,messages,links:()=>links}}
const response=()=>({setHeader(){},status(code){this.code=code;return this},json(data){this.data=data;return this}})
const request={method:'POST',headers:{'x-vercel-forwarded-for':'127.0.0.1'},body:{email:'Teacher@Example.com',adultEducator:true,consent:true}}
test('Email signup depends on configured sender and can be explicitly disabled',()=>{
 assert.equal(lessonSignupEnabled(env),true);assert.equal(lessonSignupEnabled({...env,RESEND_API_KEY:''}),false);assert.equal(lessonSignupEnabled({...env,LESSON_PUBLIC_SIGNUP_ENABLED:'false'}),false)
})
test('Verification hashes stay in email fragments, never API responses',async()=>{
 const {run,messages}=load(),r=response();await run(request,r);assert.equal(r.data.success,true);assert.equal(r.data.token,undefined);assert.equal(r.data.user,undefined);assert.equal(messages[0].to[0],'teacher@example.com');assert.match(messages[0].text,/confirm#token_hash=private-token&type=signup/)
})
test('Rate denial happens before generating auth links or sending email',async()=>{const {run,messages,links}=load(false),r=response();await run(request,r);assert.equal(r.code,429);assert.equal(messages.length,0);assert.equal(links(),0)})
test('Email delivery rejection is not reported as success',async()=>{const {run}=load(true,false),r=response();await run(request,r);assert.equal(r.code,503);assert.equal(r.data.success,undefined)})
test('Missing consent and malformed addresses cannot send email',async()=>{for(const body of [{email:'a@example.com',adultEducator:true},{email:'bad',consent:true,adultEducator:true}]){const {run,messages}=load(),r=response();await run({...request,body},r);assert.equal(r.code,400);assert.equal(messages.length,0)}})

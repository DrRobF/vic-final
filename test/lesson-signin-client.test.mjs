import test from 'node:test'
import assert from 'node:assert/strict'
import {finishLessonSignin,finishLessonCode} from '../lib/lesson-signin-client.mjs'
test('Clicking an email verifies then enrolls before redirect can happen',async()=>{
 const events=[],client={auth:{verifyOtp:async body=>{assert.equal(body.token_hash,'hash');events.push('verify');return {data:{session:{access_token:'verified-token'}},error:null}}}}
 const fetcher=async(url,options)=>{events.push('enroll');assert.equal(url,'/api/lessonplan/access');assert.equal(options.headers.Authorization,'Bearer verified-token');assert.deepEqual(JSON.parse(options.body),{completeFromEmail:true});return {ok:true,json:async()=>({success:true})}}
 assert.equal(await finishLessonSignin(client,fetcher,'#token_hash=hash&type=signup'),true);assert.deepEqual(events,['verify','enroll'])
})
test('Expired links cannot silently enroll or redirect',async()=>{let calls=0;await assert.rejects(finishLessonSignin({auth:{verifyOtp:async()=>({error:{message:'expired'}})}},async()=>{calls++},'#token_hash=hash&type=magiclink'),/expired/);assert.equal(calls,0)})
test('An older request missing recorded consent provides a clear recovery instead of reporting access',async()=>{
 const client={auth:{verifyOtp:async()=>({data:{session:{access_token:'token'}}})}}
 await assert.rejects(finishLessonSignin(client,async()=>({ok:false,json:async()=>({error:'Confirm signup choices',needsConsent:true})}),'#token_hash=hash&type=magiclink'),e=>e.needsConsent===true)
})

test('Email code creates a session and activates access before the workspace opens',async()=>{
 const events=[],client={auth:{verifyOtp:async body=>{assert.deepEqual(body,{email:'teacher@example.com',token:'123456',type:'email'});events.push('verify');return {data:{session:{access_token:'code-session'}}}}}}
 await finishLessonCode(client,async(url,options)=>{assert.equal(options.headers.Authorization,'Bearer code-session');events.push('activate');return {ok:true,json:async()=>({success:true})}},'Teacher@Example.com','123456')
 assert.deepEqual(events,['verify','activate'])
})
test('Incorrect email codes never activate account access',async()=>{
 let calls=0
 await assert.rejects(finishLessonCode({auth:{verifyOtp:async()=>({error:{message:'invalid'}})}},async()=>{calls++},'teacher@example.com','123456'),/expired or is incorrect/)
 assert.equal(calls,0)
})

test('Older email callbacks persist their session and complete account access',async()=>{
 const client={auth:{setSession:async body=>{assert.deepEqual(body,{access_token:'old-access',refresh_token:'old-refresh'});return {data:{session:{access_token:'old-access'}}}}}}
 await finishLessonSignin(client,async(url,options)=>{assert.equal(options.headers.Authorization,'Bearer old-access');return {ok:true,json:async()=>({success:true})}},'#access_token=old-access&refresh_token=old-refresh&type=magiclink')
})
test('A callback already processed by the auth SDK uses the established session',async()=>{
 const client={auth:{getSession:async()=>({data:{session:{access_token:'restored'}}})}}
 await finishLessonSignin(client,async()=>({ok:true,json:async()=>({success:true})}),'')
})

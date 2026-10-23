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
 const events=[],client={auth:{setSession:async body=>{assert.deepEqual(body,{access_token:'code-session',refresh_token:'code-refresh'});events.push('session');return {data:{session:{access_token:'code-session'}}}}}}
 const fetcher=async(url,options)=>{
  if(url==='/api/lessonplan/code'){
   // The typed address goes to the server, which decides what the code was issued against.
   assert.deepEqual(JSON.parse(options.body),{email:'teacher@example.com',code:'123456'})
   events.push('verify');return {ok:true,json:async()=>({access_token:'code-session',refresh_token:'code-refresh'})}
  }
  assert.equal(options.headers.Authorization,'Bearer code-session');events.push('activate');return {ok:true,json:async()=>({success:true})}
 }
 await finishLessonCode(client,fetcher,'Teacher@Example.com','123456')
 assert.deepEqual(events,['verify','session','activate'])
})
test('Incorrect email codes never activate account access',async()=>{
 let activations=0
 const fetcher=async url=>{
  if(url==='/api/lessonplan/code')return {ok:false,json:async()=>({error:'This code expired or is incorrect. Use your latest email or request a new one.'})}
  activations++;return {ok:true,json:async()=>({success:true})}
 }
 await assert.rejects(finishLessonCode({auth:{setSession:async()=>{throw new Error('must not reach setSession')}}},fetcher,'teacher@example.com','123456'),/expired or is incorrect/)
 assert.equal(activations,0)
})
test('A code typed for a school address signs in without the browser learning the other address',async()=>{
 // The alias case: what the teacher types is not what Supabase issued the code against.
 // The browser sends only what was typed and gets back only a session.
 let seen=null
 const client={auth:{setSession:async()=>({data:{session:{access_token:'alias-session'}}})}}
 const fetcher=async(url,options)=>{
  if(url==='/api/lessonplan/code'){seen=JSON.parse(options.body);return {ok:true,json:async()=>({access_token:'alias-session',refresh_token:'alias-refresh'})}}
  return {ok:true,json:async()=>({success:true})}
 }
 assert.equal(await finishLessonCode(client,fetcher,'rfurman@saintpetersacademy.org','654321'),true)
 assert.deepEqual(seen,{email:'rfurman@saintpetersacademy.org',code:'654321'})
})
test('A malformed code never reaches the server',async()=>{
 let calls=0
 await assert.rejects(finishLessonCode({auth:{}},async()=>{calls++},'teacher@example.com','12ab'),/verification code/)
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

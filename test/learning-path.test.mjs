import test from 'node:test'
import assert from 'node:assert/strict'
import {pathInput,cleanPath,publicPath,scoreQuiz,parseResourceList,youtubeId,verifyResources} from '../lib/learning-path.mjs'

const raw={title:'Smooth transitions',minutes:25,overview:'Transitions matter.\n\nPlan them.',keyIdeas:['a'],quiz:[0,1,2,3,4].map(i=>({question:`Q${i}`,choices:['a','b','c','d'],answer:i%4,why:'because'})),tryIt:'Try a countdown.',reflectionPrompts:['What changed?'],searchQueries:['transitions video']}

test('topic is required',()=>{assert.throws(()=>pathInput({topic:'a'}));assert.equal(pathInput({topic:'  exit   tickets '}).topic,'exit tickets')})
test('quiz answers stay hidden until submitted',()=>{const p=cleanPath(raw);assert.equal(publicPath(p,false).quiz[0].answer,undefined);assert.equal(publicPath(p,true).quiz[1].answer,1)})
test('quiz scoring',()=>{const p=cleanPath(raw);assert.equal(scoreQuiz(p.quiz,[0,1,2,3,0]),100);assert.equal(scoreQuiz(p.quiz,[1,1,2,3,0]),80);assert.throws(()=>scoreQuiz(p.quiz,[0]))})
test('resource list parsing keeps only real-looking https links',()=>{
 const list=parseResourceList('Here: [{"type":"video","title":"T","url":"https://www.youtube.com/watch?v=abc123XYZ"},{"title":"bad","url":"javascript:alert(1)"},{"title":"x","url":"http://insecure.com"}]')
 assert.equal(list.length,1);assert.equal(youtubeId(list[0].url),'abc123XYZ');assert.equal(youtubeId('https://youtu.be/q1w2e3r4'),'q1w2e3r4')
})
test('dead links are dropped',async()=>{
 const fake=async url=>url.includes('oembed')?{ok:false,status:404}:url.includes('good')?{ok:true,status:200}:{ok:false,status:404}
 const out=await verifyResources([{type:'article',title:'Good',url:'https://good.example/a'},{type:'article',title:'Dead',url:'https://dead.example/a'},{type:'video',title:'Gone',url:'https://www.youtube.com/watch?v=zzzzzzzz'}],fake)
 assert.deepEqual(out.map(r=>r.title),['Good'])
})

test('sites that block link checkers are kept; missing pages are dropped',async()=>{
 const fake=async url=>url.includes('oembed')?(url.includes('noembed')?{ok:false,status:401}:{ok:false,status:404}):url.includes('blocked')?{ok:false,status:403}:{ok:false,status:404}
 const out=await verifyResources([{type:'article',title:'Blocked but real',url:'https://blocked.example/a'},{type:'article',title:'Missing',url:'https://missing.example/a'},{type:'video',title:'No embed',url:'https://www.youtube.com/watch?v=noembed12'}],fake)
 assert.deepEqual(out.map(r=>r.title).sort(),['Blocked but real','No embed'])
 assert.equal(out.find(r=>r.type==='video').embed,false)
})

import vm from 'node:vm'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { Document,Packer,Paragraph } from 'docx'
import { extractLessonFile } from '../lib/lesson-import.mjs'
test('Import extracts actual DOCX text for teacher review',async()=>{
 const buffer=await Packer.toBuffer(new Document({sections:[{children:[new Paragraph('Old lesson: students investigate equal groups and multiplication using counters.')]}]}))
 assert.match(await extractLessonFile('old.docx',buffer),/investigate equal groups/)
})
test('Import extracts readable PDF text without rendering document HTML',async()=>{
 const stream='BT /F1 12 Tf 50 700 Td (Old lesson: explore multiplication with equal groups and arrays.) Tj ET'
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`]
 let pdf='%PDF-1.4\n';const offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`});const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
 assert.match(await extractLessonFile('old.pdf',Buffer.from(pdf)),/equal groups and arrays/)
})
test('Import rejects unsupported, oversized, empty and excessive-text files',async()=>{
 await assert.rejects(extractLessonFile('old.exe',Buffer.from('This is not a supported lesson file.')))
 await assert.rejects(extractLessonFile('old.txt',Buffer.alloc(3*1024*1024+1)))
 await assert.rejects(extractLessonFile('old.txt',Buffer.from('short')))
 await assert.rejects(extractLessonFile('old.txt',Buffer.from('x'.repeat(30001))))
 assert.match(await extractLessonFile('old.txt',Buffer.from('Old lesson text with enough detail to review and refresh.')),/review/)
})

test('File import rejects unauthorized requests before decoding or extracting',async()=>{let calls=0;const src=readFileSync(new URL('../pages/api/lessonplan/import.js',import.meta.url),'utf8').replace(/^import .*\n/gm,'').replace('export const config','const config').replace('export default async function handler','async function handler')+'\nthis.handler=handler';const context={Buffer,requireLessonEducator:async()=>({status:401,error:'Sign in'}),extractLessonFile:async()=>{calls++}};vm.createContext(context);vm.runInContext(src,context);const res={setHeader(){},status(n){this.code=n;return this},json(data){this.data=data;return this}};await context.handler({method:'POST',body:{name:'old.docx',data:'ZmFrZQ=='}},res);assert.equal(res.code,401);assert.equal(calls,0)})

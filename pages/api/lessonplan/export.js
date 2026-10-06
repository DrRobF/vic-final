import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import { requireLessonEducator } from '../../../lib/lesson-designer-auth'
import { normalizeLessonInput, validateLessonPlan, lessonOutputSections } from '../../../lib/lesson-designer.mjs'
import catalogue from '../../../data/lesson-standards.json'
import { validateWorksheet } from '../../../lib/lesson-worksheet.mjs'
export const config={api:{bodyParser:{sizeLimit:'300kb'}}}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store')
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed.'})}
 try{
  const auth=await requireLessonEducator(req);if(auth.error)return res.status(auth.status).json({error:auth.error})
  const worksheetExport=['worksheet','answer-key'].includes(req.body?.kind)
  const answers=req.body?.kind==='answer-key'
  let input,plan,sheet;try{input=normalizeLessonInput({...req.body?.input,preserveExisting:false,startingPoint:'new'},catalogue);plan=validateLessonPlan(req.body?.plan,input);if(worksheetExport)sheet=validateWorksheet(req.body?.worksheet)}catch(e){return res.status(400).json({error:e.message})}
  const paragraphs=[]
  const heading=(value,level=HeadingLevel.HEADING_1)=>paragraphs.push(new Paragraph({text:value,heading:level,spacing:{before:220,after:100}}))
  const body=value=>String(value).split('\n').forEach(line=>paragraphs.push(new Paragraph({children:[new TextRun(line)],spacing:{after:100}})))
  if(worksheetExport){
   heading(sheet.title+(answers?' — Teacher answer key':''),HeadingLevel.TITLE)
   sheet.versions.forEach((v,i)=>{if(i)paragraphs.push(new Paragraph({text:'',pageBreakBefore:true}));heading(v.label);if(!answers){body('Name: ______________________________    Date: ______________');body(v.directions);if(v.passage)body(v.passage)}
    v.questions.forEach((q,n)=>{body(`${n+1}. ${q.prompt}`);if(answers)body(`Answer: ${q.answer}`);else{body('________________________________________________________________');body('________________________________________________________________');body('')}})
   })
   if(answers){heading('Teacher review');sheet.reviewNotes.forEach(body);body('Check every question and answer before sharing the student worksheet.')}
  }else{
  heading(plan.title,HeadingLevel.TITLE);body(`${input.state} | Grade ${input.grade} | ${input.subject} | ${input.sessions||1} session(s), ${input.minutes} minutes each`)
  for(const s of lessonOutputSections(plan,input)){heading(s.heading);body(s.body)}
  body('Review accuracy, pacing, materials, and suitability before teaching or submitting.');body('Created with Ask VIC Lesson Designer | askvic.ai/lessonplan')
  }
  const buffer=await Packer.toBuffer(new Document({creator:'Ask VIC Lesson Designer',title:worksheetExport?sheet.title:plan.title,styles:{default:{document:{run:{font:'Calibri',size:22}}}},sections:[{properties:{},children:paragraphs}]}))
  res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.wordprocessingml.document');res.setHeader('Content-Disposition',`attachment; filename="${worksheetExport?(answers?'Ask-VIC-Answer-Key':'Ask-VIC-Student-Worksheet'):'Ask-VIC-Lesson-Plan'}.docx"`);return res.status(200).send(buffer)
 }catch(error){console.error('Lesson export failed',{name:error?.name});return res.status(500).json({error:'Could not download the document. Copy the sections or download the text version instead.'})}
}

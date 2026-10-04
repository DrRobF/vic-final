import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import { requireLessonEducator } from '../../../lib/lesson-designer-auth'
import { normalizeLessonInput, validateLessonPlan } from '../../../lib/lesson-designer.mjs'
import catalogue from '../../../data/lesson-standards.json'
export const config={api:{bodyParser:{sizeLimit:'160kb'}}}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store')
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed.'})}
 try{
  const auth=await requireLessonEducator(req);if(auth.error)return res.status(auth.status).json({error:auth.error})
  let input,plan;try{input=normalizeLessonInput(req.body?.input,catalogue);plan=validateLessonPlan(req.body?.plan,input)}catch(e){return res.status(400).json({error:e.message})}
  const paragraphs=[]
  const heading=(value,level=HeadingLevel.HEADING_1)=>paragraphs.push(new Paragraph({text:value,heading:level,spacing:{before:220,after:100}}))
  const body=value=>String(value).split('\n').forEach(line=>paragraphs.push(new Paragraph({children:[new TextRun(line)],spacing:{after:100}})))
  heading(plan.title,HeadingLevel.TITLE);body(`${input.state} | Grade ${input.grade} | ${input.subject} | ${input.minutes} minutes`)
  heading('Standards');for(const s of input.standards){body(`${s.code}: ${s.text}`);if(s.source)body(`Source: ${s.source} | PDF page ${s.page} | ${s.version}`);else body('Teacher-provided standard; confirm wording and applicability.')}
  for(const s of plan.sections){heading(s.heading);body(s.body)}
  heading('Standard alignment');for(const a of plan.alignment){heading(a.code,HeadingLevel.HEADING_2);body(`Objective: ${a.objective}\nActivity: ${a.activity}\nAssessment: ${a.assessment}`)}
  heading('Teacher review');plan.reviewNotes.forEach(body);body('Review accuracy, pacing, materials, and suitability before teaching or submitting.');body('Created with Ask VIC Lesson Designer | askvic.ai/lessonplan')
  const buffer=await Packer.toBuffer(new Document({creator:'Ask VIC Lesson Designer',title:plan.title,styles:{default:{document:{run:{font:'Calibri',size:22}}}},sections:[{properties:{},children:paragraphs}]}))
  res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.wordprocessingml.document');res.setHeader('Content-Disposition','attachment; filename="Ask-VIC-Lesson-Plan.docx"');return res.status(200).send(buffer)
 }catch(error){console.error('Lesson export failed',{name:error?.name});return res.status(500).json({error:'Could not download the document. Copy the sections or download the text version instead.'})}
}

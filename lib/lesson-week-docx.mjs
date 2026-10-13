import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from 'docx'
import { lessonOutputSections } from './lesson-designer.mjs'
import { formatDay, gradeLabel, subjectLabel, weekLabel } from './lesson-week.mjs'
import { versionLabel, versionKey } from './levels.mjs'

// One Word document for the whole week: a week-at-a-glance table, then each day's lesson,
// student worksheet and answer key on their own pages.
export async function buildWeekDocx(submission,{schoolName='',status=''}={}){
 const children=[]
 const heading=(value,level=HeadingLevel.HEADING_1,pageBreakBefore=false)=>children.push(new Paragraph({text:String(value),heading:level,pageBreakBefore,spacing:{before:220,after:100}}))
 const body=value=>String(value??'').split('\n').forEach(line=>children.push(new Paragraph({children:[new TextRun(line)],spacing:{after:100}})))
 const cell=(value,bold=false)=>new TableCell({children:String(value).split('\n').map(line=>new Paragraph({children:[new TextRun({text:line,bold})]}))})

 heading(`${weekLabel(submission.weekOf)} — Lesson Plans`,HeadingLevel.TITLE)
 body([submission.teacherName,schoolName,`${gradeLabel(submission.grade)} · ${subjectLabel(submission.subject)} · ${submission.state} · ${submission.minutes} minutes per lesson`].filter(Boolean).join('\n'))
 if(status)body(status)
 heading('Week at a glance',HeadingLevel.HEADING_2)
 children.push(new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[
  new TableRow({tableHeader:true,children:['Day','Lesson','Standards'].map(v=>cell(v,true))}),
  ...submission.days.map(d=>new TableRow({children:[cell(`${d.dayName}\n${formatDay(d.date,{month:'short',day:'numeric'})}`),cell(d.off?'No lesson planned':d.title||d.topic||''),cell(d.off?'—':d.standards.map(s=>s.code).join('\n'))]}))
 ]}))

 for(const day of submission.days){
  heading(`${formatDay(day.date)} — ${day.off?'No lesson planned':day.title}`,HeadingLevel.HEADING_1,true)
  if(day.off){body('This day was marked as no lesson (holiday, testing, assembly or another event).');continue}
  for(const section of lessonOutputSections(day.plan,day.input)){heading(section.heading,HeadingLevel.HEADING_2);body(section.body)}
  const sheet=day.worksheet
  if(!sheet)continue
  heading(`Student worksheet — ${sheet.title}`,HeadingLevel.HEADING_1,true)
  sheet.versions.forEach((v,i)=>{
   if(i)children.push(new Paragraph({text:'',pageBreakBefore:true}))
   heading(v.label,HeadingLevel.HEADING_2)
   body('Name: ______________________________    Date: ______________')
   body(v.directions)
   if(v.passage)body(v.passage)
   v.questions.forEach((q,n)=>{body(`${n+1}. ${q.prompt}`);body('________________________________________________________________');body('________________________________________________________________');body('')})
  })
  heading(`Answer key — ${sheet.title}`,HeadingLevel.HEADING_1,true)
  if(versionKey(sheet,day.input?.groups))body(versionKey(sheet,day.input?.groups))
  sheet.versions.forEach((v,vi)=>{heading(versionLabel(v,vi,day.input?.groups),HeadingLevel.HEADING_2);v.questions.forEach((q,n)=>{body(`${n+1}. ${q.prompt}`);body(`Answer: ${q.answer}`)})})
 }
 body('')
 body('Review accuracy, pacing, materials, and suitability before teaching. Created with Ask VIC Lesson Designer | askvic.ai')
 return Packer.toBuffer(new Document({creator:'Ask VIC Lesson Designer',title:`${weekLabel(submission.weekOf)} — ${submission.teacherName||'Lesson plans'}`,styles:{default:{document:{run:{font:'Calibri',size:22}}}},sections:[{properties:{},children}]}))
}

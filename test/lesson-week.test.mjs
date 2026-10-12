import test from 'node:test'
import assert from 'node:assert/strict'
import catalogue from '../data/lesson-standards.json' with { type: 'json' }
import { normalizeLessonInput, DEFAULT_SECTIONS, GROUP_DEFAULTS } from '../lib/lesson-designer.mjs'
import { mondayOf, weekDates, defaultWeekOf, normalizeWeekSetup, lessonIntoWeekDay, weekStandardRows, weekContextInstructions, dayLessonRequest, buildWeekSubmission, submissionEmail, reviewEmail, validEmail, weekFileName } from '../lib/lesson-week.mjs'

const ID='3b241101-e2bb-4255-8caf-4136c566a962'
const LESSON='9c2a1d0e-1111-4222-8333-944455556666'
const math3=catalogue.filter(r=>r.state==='FL'&&r.grade==='3'&&r.subject==='math')
const day=(i,extra={})=>({off:false,standardIds:[math3[i].id],topic:'',lessonId:null,...extra})
const setup=(extra={})=>({id:ID,weekOf:'2026-10-21',state:'FL',grade:'3',subject:'math',minutes:45,days:[0,1,2,3,4].map(i=>day(i)),settings:{groups:['More support','On level']},...extra})

test('any date maps to its Monday and the five school days', () => {
 assert.equal(mondayOf('2026-10-21'),'2026-10-19')
 assert.equal(mondayOf('2026-10-25'),'2026-10-19')
 assert.equal(mondayOf('2026-10-19'),'2026-10-19')
 assert.equal(mondayOf('2026-02-30'),null)
 assert.deepEqual(weekDates('2026-10-23'),['2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-23'])
 assert.equal(defaultWeekOf(new Date(2026,9,13)),'2026-10-12')
 assert.equal(defaultWeekOf(new Date(2026,9,16)),'2026-10-19')
})

test('a week keeps one official standard per day from the matching catalogue', () => {
 const week=normalizeWeekSetup(setup(),catalogue)
 assert.equal(week.weekOf,'2026-10-19')
 assert.equal(week.days.length,5)
 assert.equal(week.days[2].date,'2026-10-21')
 assert.equal(week.days[0].standards[0].code,math3[0].code)
 assert.equal(week.days[0].standards[0].origin,'official')
 assert.equal(week.settings.worksheet,true)
})

test('forged or mismatched standards, empty days and all-off weeks are refused', () => {
 const reading=catalogue.find(r=>r.state==='FL'&&r.grade==='3'&&r.subject==='reading')
 assert.throws(()=>normalizeWeekSetup(setup({days:[day(0,{standardIds:[reading.id]}),day(1),day(2),day(3),day(4)]}),catalogue),/Monday: a standard does not match/)
 assert.throws(()=>normalizeWeekSetup(setup({days:[day(0,{standardIds:['FL:MADE.UP']}),day(1),day(2),day(3),day(4)]}),catalogue),/does not match/)
 assert.throws(()=>normalizeWeekSetup(setup({days:[day(0),day(1,{standardIds:[]}),day(2),day(3),day(4)]}),catalogue),/Tuesday: choose a standard, plan it in the detailed lesson planner/)
 assert.throws(()=>normalizeWeekSetup(setup({days:Array.from({length:5},()=>({off:true}))}),catalogue),/at least one day/)
 assert.throws(()=>normalizeWeekSetup(setup({days:[day(0)]}),catalogue),/five school days/)
 assert.throws(()=>normalizeWeekSetup(setup({id:'not-a-uuid'}),catalogue),/could not be saved/)
})

test('off days and pasted standards are kept, and pasted standards are marked teacher-provided', () => {
 const week=normalizeWeekSetup({...setup(),state:'Ohio',days:[{off:false,customCode:'3.NF.1',customStandard:'Understand a fraction 1/b.'},{off:true,standardIds:['x'],lessonId:LESSON},{off:false,customStandard:'Compare fractions.'},{off:true},{off:true}]},catalogue)
 assert.equal(week.days[0].standards[0].origin,'teacher')
 assert.equal(week.days[0].standards[0].code,'3.NF.1')
 assert.equal(week.days[2].standards[0].code,'Teacher-provided standard')
 assert.deepEqual(week.days[1].standards,[])
 assert.equal(week.days[1].lessonId,null)
})

test('each planned standard becomes one coverage row for the curriculum map', () => {
 const week=normalizeWeekSetup(setup({days:[day(0),day(0),{off:true},day(1,{customStandard:'Teacher goal'}),day(2)]}),catalogue)
 const rows=weekStandardRows(week,'user-1','school-1')
 assert.equal(rows.length,5)
 assert.deepEqual(rows.map(r=>r.day_index),[0,1,3,3,4])
 assert.ok(rows.every(r=>r.school_id==='school-1'&&r.user_id==='user-1'&&r.week_id===ID&&r.subject==='math'))
 assert.equal(rows.find(r=>r.origin==='teacher').standard_text,'Teacher goal')
})

test('each day knows its place in the week and requests a normal single lesson', () => {
 const week=normalizeWeekSetup(setup({days:[day(0,{topic:'Arrays'}),{off:true},day(2),day(3),day(4,{topic:'Quiz review'})]}),catalogue)
 const first=weekContextInstructions(week,0),last=weekContextInstructions(week,4)
 assert.match(first,/Monday, lesson 1 of 4/)
 assert.match(first,/Later this week: Wednesday/)
 assert.match(last,/Earlier this week: Monday: Arrays/)
 assert.match(last,/cumulative check/)
 const body=dayLessonRequest(week,2,{sections:DEFAULT_SECTIONS,instructions:'Start objectives with Students will.',groups:GROUP_DEFAULTS.slice(0,2)})
 assert.equal(body.weekId,ID)
 assert.match(body.instructions,/Students will/)
 const input=normalizeLessonInput(body,catalogue)
 assert.equal(input.standards[0].code,math3[2].code)
 assert.equal(input.scope,'lesson')
 assert.ok(input.instructions.length<=1500)
 assert.throws(()=>dayLessonRequest(week,1,{sections:DEFAULT_SECTIONS}),/no lesson planned/)
})

test('a week can only be sent when every planned day has a saved lesson', () => {
 const week=normalizeWeekSetup(setup({days:[day(0,{lessonId:LESSON}),{off:true},{off:true},{off:true},day(4)]}),catalogue)
 const lessons=new Map([[LESSON,{plan:{title:'Equal groups'},input:{subject:'math'},worksheet:{title:'Practice'}}]])
 assert.throws(()=>buildWeekSubmission(week,lessons,'Ms. Rivera'),/Friday does not have a finished lesson/)
 week.days[4].lessonId=LESSON
 const sent=buildWeekSubmission(week,lessons,'Ms. Rivera')
 assert.equal(sent.teacherName,'Ms. Rivera')
 assert.equal(sent.days[0].title,'Equal groups')
 assert.equal(sent.days[1].off,true)
 const mail=submissionEmail({teacherName:'Ms. Rivera',schoolName:'Saint Peter’s Academy',week,reviewUrl:'https://www.askvic.ai/weeklyplans?plan=1',days:sent.days})
 assert.match(mail.subject,/Week of October 19, 2026/)
 assert.match(mail.body,/Tuesday: No lesson planned/)
 assert.match(mail.body,/worksheets and answer keys/)
 assert.match(reviewEmail({teacherName:'Ana Rivera',reviewerName:'Dr. Furman',week,comment:'Great pacing.'}).body,/Hi Ana,[\s\S]*Great pacing/)
 assert.equal(weekFileName(week),'Lesson-Plans-2026-10-19-Math.docx')
})

test('only plausible email addresses are accepted for emailed weeks', () => {
 assert.equal(validEmail(' Principal@School.org '),'principal@school.org')
 assert.equal(validEmail('nope'),'')
 assert.equal(validEmail('a@b.c, evil@x.com'),'')
})

test('a saved week can hold days that are not planned yet, and sending still needs every day finished', () => {
 const partial=setup({days:[day(0,{lessonId:LESSON}),{off:false,standardIds:[],topic:''},{off:true},{off:false,standardIds:[]},day(4)]})
 assert.throws(()=>normalizeWeekSetup(partial,catalogue),/Tuesday: choose a standard/)
 const week=normalizeWeekSetup(partial,catalogue,{allowEmpty:true})
 assert.deepEqual(week.days[1].standards,[])
 assert.equal(week.days[0].lessonId,LESSON)
 assert.ok(normalizeWeekSetup(setup({days:Array.from({length:5},()=>({off:false,standardIds:[]}))}),catalogue,{allowEmpty:true}))
 assert.match(weekContextInstructions(week,4),/Tuesday: a lesson the teacher is planning separately/)
 const lessons=new Map([[LESSON,{plan:{title:'Arrays'},input:{}}]])
 assert.throws(()=>buildWeekSubmission(week,lessons,'Ms. Rivera'),/Tuesday does not have a finished lesson yet/)
})

test('a detailed single lesson drops into the chosen day with its own standards and topic', () => {
 const official=math3[3]
 const input={state:'FL',grade:'3',subject:'math',topic:'Area with tiles',standardIds:[official.id],standards:[{code:official.code,text:official.text,origin:'official'},{code:'Teacher-provided standard',text:'Explain with a model.',origin:'teacher'}]}
 const days=lessonIntoWeekDay(null,2,LESSON,input)
 assert.equal(days.length,5)
 assert.deepEqual(days[2],{off:false,standardIds:[official.id],customStandard:'Explain with a model.',customCode:'',topic:'Area with tiles',lessonId:LESSON})
 assert.equal(days[0].lessonId,null)
 const week=normalizeWeekSetup(setup({days}),catalogue,{allowEmpty:true})
 assert.deepEqual(week.days[2].standards.map(s=>s.origin),['official','teacher'])
 const kept=lessonIntoWeekDay(week.days,0,'0f1e2d3c-1111-4222-8333-944455556666',{standardIds:[math3[0].id],topic:'Warm start'})
 assert.equal(kept[2].lessonId,LESSON)
 assert.equal(kept[0].topic,'Warm start')
 assert.throws(()=>lessonIntoWeekDay(days,5,LESSON,input),/Monday to Friday/)
})

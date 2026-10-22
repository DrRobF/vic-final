import { requireApprovedProfile } from '../../../lib/server-auth'
import catalogue from '../../../data/lesson-standards.json'
import { schoolToday, schoolDayStart } from '../../../lib/release.mjs'
import { mondayOf } from '../../../lib/lesson-week.mjs'

const STATE = 'FL'
const SUBJECT_WORDS = { math: /math/i, reading: /reading|ela|english/i }
const VIC_CLASS = /\bVIC\b/
const toMode = l => (l === 'remediation' ? 'remediation' : l === 'enrichment' ? 'enrichment' : 'on-level')
// Reading practice in a chat works best on the reading and vocabulary strands (not cursive or essays).
const practiceable = s => s.subject === 'math' || /^ELA\.\d+\.(R|V)\./.test(s.code)
const byId = new Map(catalogue.map(s => [s.id, s]))

// VIC practice path: the next skill for this student in this class. First the standards the class
// teacher has planned this week and earlier (most recent first), then the rest of the grade's
// standards in order. A skill met in the last two weeks is skipped. A practice skill started today
// without a verdict yet is picked up again instead of starting a new one.
export default async function handler(req, res) {
 res.setHeader('Cache-Control', 'no-store')
 if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed.' }) }
 const auth = await requireApprovedProfile(req)
 if (auth.error) return res.status(auth.status).json({ error: auth.error })
 if (auth.profile.role !== 'student') return res.status(403).json({ error: 'Practice is for students.' })
 const db = auth.admin, me = auth.profile.id, classId = Number(req.body?.classId), wanted = ['math', 'reading'].includes(req.body?.subject) ? req.body.subject : null
 if (!Number.isInteger(classId)) return res.status(400).json({ error: 'Choose a class.' })
 try {
  const { data: enrollment } = await db.from('enrollments').select('support_level,classes:class_id(id,class_name,grade_level,teacher_id,users:teacher_id(auth_user_id))').eq('student_id', me).eq('class_id', classId).maybeSingle()
  const cls = enrollment?.classes
  if (!cls) return res.status(403).json({ error: 'You’re not in that class.' })
  // A VIC & IXL class practices both subjects; the child's own grade decides the standards.
  const vicClass = VIC_CLASS.test(cls.class_name || '')
  const subject = vicClass ? wanted : SUBJECT_WORDS.math.test(cls.class_name) ? 'math' : SUBJECT_WORDS.reading.test(cls.class_name) ? 'reading' : null
  const { data: meRow } = await db.from('users').select('grade_level').eq('id', me).maybeSingle()
  const ownGrade = meRow?.grade_level ?? cls.grade_level
  const grade = ownGrade == null ? null : String(ownGrade)
  if (!subject || !grade) return res.status(400).json({ error: 'Practice isn’t ready for this class yet.' })

  const dayStart = schoolDayStart(schoolToday())
  // Today's practice without a verdict yet: keep going with it.
  const { data: openRows } = await db.from('assignments').select('id,lesson_id,lessons!inner(id,class_id,practice_standard)').eq('student_id', me).eq('lessons.class_id', classId).not('lessons.practice_standard', 'is', null).gte('assigned_at', dayStart).order('assigned_at', { ascending: false }).limit(10)
  // In a VIC class, only resume practice in the subject the child picked.
  const open = (openRows || []).filter(r => !vicClass || byId.get(r.lessons?.practice_standard)?.subject === subject)
  if (open[0]) {
   const { data: done } = await db.from('vic_goal_results').select('id').eq('assignment_id', open[0].id).limit(1)
   if (!done?.length) return res.json({ lessonId: open[0].lesson_id, classId, resumed: true })
  }

  // Taught standards from the week plans of the teacher who teaches this subject, most recent week first.
  // In a VIC class that is the child's Math or ELA teacher, not the VIC teacher.
  let owner = cls.users?.auth_user_id
  if (vicClass) {
   const { data: mine } = await db.from('enrollments').select('classes:class_id(class_name,users:teacher_id(auth_user_id))').eq('student_id', me)
   const content = (mine || []).map(m => m.classes).find(c => c && !VIC_CLASS.test(c.class_name || '') && SUBJECT_WORDS[subject].test(c.class_name || ''))
   owner = content?.users?.auth_user_id || null
  }
  const thisWeek = mondayOf(schoolToday())
  const { data: weeks } = owner ? await db.from('lesson_weeks').select('week_of,grade,subject,days').eq('user_id', owner).eq('subject', subject).eq('grade', grade).lte('week_of', thisWeek).order('week_of', { ascending: false }).limit(8) : { data: [] }
  const taught = []
  for (const w of weeks || []) for (const d of [...(w.days || [])].reverse()) for (const id of d?.standardIds || []) if (!taught.includes(id) && byId.get(id)?.state === STATE) taught.push(id)
  const rest = catalogue.filter(s => s.state === STATE && s.subject === subject && s.grade === grade && practiceable(s)).map(s => s.id)
  const order = [...taught.filter(id => practiceable(byId.get(id))), ...rest.filter(id => !taught.includes(id))]
  if (!order.length) return res.status(400).json({ error: 'Practice isn’t ready for this class yet.' })

  const since = new Date(Date.now() - 14 * 86400000).toISOString()
  const { data: results } = await db.from('vic_goal_results').select('standard_id,verdict,created_at').eq('student_id', me).gte('created_at', since)
  const metRecently = new Set((results || []).filter(r => r.verdict === 'met').map(r => r.standard_id))
  const today = new Set((results || []).filter(r => r.created_at >= dayStart).map(r => r.standard_id))
  // Not met recently, and not already finished today (so a "not yet" waits for another day).
  const next = order.find(id => !metRecently.has(id) && !today.has(id)) || order.find(id => !today.has(id)) || order[0]
  const std = byId.get(next)

  const title = `Practice: ${std.text.length > 90 ? `${std.text.slice(0, 87)}…` : std.text}`
  const { data: lesson, error: lErr } = await db.from('lessons').insert({ class_id: classId, teacher_id: cls.teacher_id, subject: cls.class_name, title, lesson_text: `${std.code}: ${std.text}`, is_active: true, practice_standard: std.id }).select('id').single()
  if (lErr) throw lErr
  const { error: aErr } = await db.from('assignments').insert({ lesson_id: lesson.id, student_id: me, mode: toMode(enrollment.support_level), status: 'assigned', assigned_at: new Date().toISOString() })
  if (aErr) { await db.from('lessons').delete().eq('id', lesson.id); throw aErr }
  return res.json({ lessonId: lesson.id, classId, standard: std.code })
 } catch (e) {
  console.error('[student/practice] failed', { message: e?.message })
  return res.status(500).json({ error: 'Could not start practice. Please try again.' })
 }
}

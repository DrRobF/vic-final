// Picking the next skill for one child, and starting it.
//
// Two adults reach this by different doors. A child taps "Reading practice" on /askvic, and
// the aide running the VIC Room taps one button for the whole group when no teacher planned a
// lesson. Both want the same thing -- this child's next standard, at this child's level -- so
// it lives here once instead of twice, the same reasoning as lib/lesson-launch.mjs.
//
// "Next" means: what the child's own content teacher has planned this week and earlier, most
// recent first, then the rest of their level's standards in order. That is the curriculum map.
// A skill met in the last two weeks is skipped; a skill already finished today waits for
// another day.
import { schoolToday, schoolDayStart } from './release.mjs'
import { mondayOf } from './lesson-week.mjs'
import { DEFAULT_SUPPORTS, levelFor, toGrade, trackFor } from './learner-profile.mjs'

const STATE = 'FL'
const SUBJECT_WORDS = { math: /math/i, reading: /reading|ela|english/i }
export const VIC_CLASS = /\bVIC\b/
const toMode = l => (l === 'remediation' ? 'remediation' : l === 'enrichment' ? 'enrichment' : 'on-level')

// Practice happens in a chat, which suits the reading and vocabulary strands rather than
// cursive or essays. Access Points use the same strand letters.
const practiceable = s => !!s && (s.subject === 'math' || /^ELA\.[K\d]+\.(R|V)\./.test(s.code))

// The catalogues are passed in rather than imported, so this module stays free of data
// imports: node's ESM needs import attributes for JSON while webpack does not, and a lib that
// both the API routes and the tests can load without ceremony is worth more than the shorthand.
// Callers pass { general, access } from data/lesson-standards.json and data/access-points.json.
const index = cat => new Map([...(cat?.general || []), ...(cat?.access || [])].map(s => [s.id, s]))

/** The child's own class for this subject, used to find whose plan to follow. */
function contentClass(enrollments, subject) {
 return (enrollments || []).map(e => e.classes).find(c =>
  c && !VIC_CLASS.test(c.class_name || '') && SUBJECT_WORDS[subject].test(c.class_name || ''))
}

/**
 * Where this child is working, and which catalogue they work from.
 * The instructional level is the whole point: a Grade 6 student working at Grade 1 gets Grade 1
 * standards, and a Grade 6 student working at Grade 8 gets Grade 8 ones. The enrolled grade is
 * only the fallback when nobody has set a level.
 */
export async function learnerFor(db, studentId, subject, classGrade = null) {
 const [{ data: me }, { data: levels }, { data: supportRow }] = await Promise.all([
  db.from('users').select('grade_level').eq('id', studentId).maybeSingle(),
  db.from('student_levels').select('subject,level,source,confirmed_at').eq('student_id', studentId),
  db.from('student_supports').select('read_aloud,language,alternate_standards').eq('student_id', studentId).maybeSingle(),
 ])
 const enrolled = me?.grade_level ?? classGrade
 const supports = { ...DEFAULT_SUPPORTS, ...(supportRow || {}) }
 return { ...levelFor(levels || [], subject, enrolled), enrolled, supports }
}

/**
 * The ordered list of standards to work through, most urgent first.
 * Returns `{ error }` rather than a silent fallback when a child is on Access Points and there
 * are none to teach from -- quietly handing them grade-level standards is the failure that
 * looks like it is working.
 */
export async function practiceOrder(db, { subject, learner, enrollments, catalogues }) {
 const byId = index(catalogues)
 const access = catalogues?.access || []
 const general = catalogues?.general || []
 const grade = toGrade(learner.level)
 if (!grade) return { error: 'Practice isn’t ready for this student yet — no grade or level is set.' }

 const chosen = trackFor(learner.supports, access)
 if (!chosen.available) return { error: chosen.reason || 'No alternate standards are available yet.' }
 const pool = chosen.track === 'access' ? access : general

 // What the child's own content teacher planned, most recent week first.
 const content = contentClass(enrollments, subject)
 const owner = content?.users?.auth_user_id || null
 // A mixed 3/4 group is planned as one grade; what the teacher taught that group comes first.
 const planGrade = content?.grade_level == null ? grade : String(content.grade_level)
 const thisWeek = mondayOf(schoolToday())
 const { data: weeks } = owner
  ? await db.from('lesson_weeks').select('week_of,grade,subject,days').eq('user_id', owner).eq('subject', subject)
     .in('grade', [...new Set([planGrade, grade])]).lte('week_of', thisWeek)
     .order('week_of', { ascending: false }).limit(8)
  : { data: [] }

 const taught = []
 for (const w of weeks || []) {
  for (const d of [...(w.days || [])].reverse()) {
   for (const id of d?.standardIds || []) {
    const std = byId.get(id)
    if (!taught.includes(id) && std?.state === STATE && practiceable(std) &&
        (chosen.track === 'access' ? std.track === 'access' : std.track !== 'access')) taught.push(id)
   }
  }
 }
 const rest = pool.filter(s => s.state === STATE && s.subject === subject && s.grade === grade && practiceable(s)).map(s => s.id)
 const order = [...taught, ...rest.filter(id => !taught.includes(id))]
 return order.length ? { order, track: chosen.track } : { error: 'Practice isn’t ready for this student yet.' }
}

/**
 * Start (or resume) one child's practice in one class.
 * Resuming matters: a child who started a skill this morning and is still on it should carry
 * on, not be handed a second one because an adult pressed the button.
 */
export async function startPractice(db, { studentId, classId, subject, catalogues }) {
 const byId = index(catalogues)
 const { data: enrollments } = await db.from('enrollments')
  .select('class_id,support_level,classes:class_id(id,class_name,grade_level,teacher_id,users:teacher_id(auth_user_id))')
  .eq('student_id', studentId)
 const here = (enrollments || []).find(e => Number(e.class_id) === Number(classId))
 const cls = here?.classes
 if (!cls) return { error: 'That student isn’t in that class.' }

 const vicClass = VIC_CLASS.test(cls.class_name || '')
 const want = vicClass ? subject
  : SUBJECT_WORDS.math.test(cls.class_name) ? 'math'
  : SUBJECT_WORDS.reading.test(cls.class_name) ? 'reading' : null
 if (!['math', 'reading'].includes(want)) return { error: 'Choose reading or math.' }

 const dayStart = schoolDayStart(schoolToday())
 // Today's practice with no verdict yet: keep going with it.
 const { data: openRows } = await db.from('assignments')
  .select('id,lesson_id,lessons!inner(id,class_id,practice_standard)')
  .eq('student_id', studentId).eq('lessons.class_id', classId)
  .not('lessons.practice_standard', 'is', null)
  .gte('assigned_at', dayStart).order('assigned_at', { ascending: false }).limit(10)
 const open = (openRows || []).filter(r => !vicClass || byId.get(r.lessons?.practice_standard)?.subject === want)
 if (open[0]) {
  const { data: done } = await db.from('vic_goal_results').select('id').eq('assignment_id', open[0].id).limit(1)
  if (!done?.length) return { lessonId: open[0].lesson_id, classId, resumed: true }
 }

 const learner = await learnerFor(db, studentId, want, cls.grade_level)
 const picked = await practiceOrder(db, { subject: want, learner, enrollments, catalogues })
 if (picked.error) return { error: picked.error }

 const since = new Date(Date.now() - 14 * 86400000).toISOString()
 const { data: results } = await db.from('vic_goal_results').select('standard_id,verdict,created_at')
  .eq('student_id', studentId).gte('created_at', since)
 const metRecently = new Set((results || []).filter(r => r.verdict === 'met').map(r => r.standard_id))
 const today = new Set((results || []).filter(r => r.created_at >= dayStart).map(r => r.standard_id))
 const next = picked.order.find(id => !metRecently.has(id) && !today.has(id))
  || picked.order.find(id => !today.has(id)) || picked.order[0]
 const std = byId.get(next)
 if (!std) return { error: 'Practice isn’t ready for this student yet.' }

 const title = `Practice: ${std.text.length > 90 ? `${std.text.slice(0, 87)}…` : std.text}`
 const { data: lesson, error: lErr } = await db.from('lessons').insert({
  class_id: classId, teacher_id: cls.teacher_id, subject: cls.class_name,
  title, lesson_text: `${std.code}: ${std.text}`, is_active: true, practice_standard: std.id,
 }).select('id').single()
 if (lErr) throw lErr
 const { error: aErr } = await db.from('assignments').insert({
  lesson_id: lesson.id, student_id: studentId, mode: toMode(here.support_level),
  status: 'assigned', assigned_at: new Date().toISOString(),
 })
 if (aErr) { await db.from('lessons').delete().eq('id', lesson.id); throw aErr }
 return { lessonId: lesson.id, classId, standard: std.code, track: picked.track, level: learner.level }
}

/**
 * Start practice for everyone in a room. One child failing must not stop the rest: an aide
 * pressing this at 8:05 needs the other ten children working, not an error page.
 */
export async function practiceForRoom(db, { students, subject, catalogues }) {
 const out = { started: 0, resumed: 0, skipped: [] }
 for (const s of students || []) {
  // Practice belongs in the child's VIC class where there is one, otherwise their class in
  // this room that matches the subject.
  const classId = s.vicClassId || s.classIds?.[0]
  if (!classId) { out.skipped.push({ name: s.name, why: 'no class in this room' }); continue }
  try {
   const r = await startPractice(db, { studentId: s.id, classId, subject, catalogues })
   if (r.error) out.skipped.push({ name: s.name, why: r.error })
   else if (r.resumed) out.resumed += 1
   else out.started += 1
  } catch (e) {
   out.skipped.push({ name: s.name, why: 'could not start' })
   console.error('[practiceForRoom] failed', { student: s.id, message: e?.message })
  }
 }
 return out
}

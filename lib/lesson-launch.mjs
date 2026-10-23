// Putting a teacher's planned lesson on a class's screens.
//
// Two adults do this for the same reason: the aide running the VIC Room every day, and
// whoever is covering a class when its teacher is out. One is a standing arrangement and
// one lasts a day, but the mechanic is identical -- find what the class's own teacher
// planned for today, check VIC can teach from it, and assign it to every child at their
// own level. So it lives here once rather than twice.
import { schoolToday, schoolDayStart } from './release.mjs'
import { mondayOf, weekDates } from './lesson-week.mjs'
import { matchClass } from './class-match.mjs'
import { vicTargetText } from './lesson-companion.mjs'

const toMode = l => (l === 'remediation' ? 'remediation' : l === 'enrichment' ? 'enrichment' : 'on-level')

// What the teachers of these classes planned for today, and whether VIC can teach it yet.
// `ready` false means the plan has no standard or objective: VIC has nothing to aim at, and
// only the teacher can fix it. `live` means it is already on their screens.
export async function plannedToday(db, classIds, day = schoolToday()) {
 const ids = (classIds || []).map(Number).filter(Number.isInteger)
 if (!ids.length) return []
 const { data: classes } = await db.from('classes')
  .select('id,class_name,grade_level,teacher_id,users:teacher_id(auth_user_id,name)').in('id', ids)
 const weekOf = mondayOf(day), idx = weekDates(weekOf).indexOf(day)
 if (idx < 0 || !classes?.length) return []
 const owners = [...new Set(classes.map(c => c.users?.auth_user_id).filter(Boolean))]
 const { data: weeks } = owners.length
  ? await db.from('lesson_weeks').select('user_id,grade,subject,days').in('user_id', owners).eq('week_of', weekOf)
  : { data: [] }
 const out = []
 for (const w of weeks || []) {
  const lessonId = w.days?.[idx]?.lessonId
  if (!lessonId || w.days[idx].off) continue
  const theirs = classes.filter(c => c.users?.auth_user_id === w.user_id)
  const cls = matchClass(theirs, w)
  if (!cls || out.some(o => o.lessonId === lessonId && o.classId === cls.id)) continue
  out.push({ lessonId, classId: cls.id, className: cls.class_name, teacher: cls.users?.name || '' })
 }
 if (!out.length) return []
 const lessonIds = out.map(o => o.lessonId)
 const [{ data: drafts }, { data: sent }] = await Promise.all([
  db.from('educator_lessons').select('id,title,draft').in('id', lessonIds),
  db.from('lessons').select('source_lesson_id,class_id,assignments!inner(assigned_at)').in('source_lesson_id', lessonIds)
   .gte('assignments.assigned_at', schoolDayStart(day)).lte('assignments.assigned_at', new Date().toISOString()),
 ])
 const draftBy = new Map((drafts || []).map(d => [d.id, d]))
 return out.map(o => {
  const d = draftBy.get(o.lessonId)
  let ready = true; try { vicTargetText(d?.draft) } catch { ready = false }
  return {
   ...o,
   title: d?.draft?.plan?.title || d?.title || 'Lesson',
   objective: typeof d?.draft?.plan?.objective === 'string' ? d.draft.plan.objective : '',
   ready,
   live: (sent || []).some(x => x.source_lesson_id === o.lessonId && Number(x.class_id) === Number(o.classId)),
  }
 })
}

// Send one planned lesson to one class. Every child in the class gets it at their own level.
// Callers decide who is allowed to do this; by the time it is called that is settled.
export async function launchLesson(db, { classId, lessonId }) {
 const { data: src } = await db.from('educator_lessons').select('id,title,draft').eq('id', lessonId).maybeSingle()
 const { data: cls } = await db.from('classes').select('id,class_name,teacher_id').eq('id', classId).maybeSingle()
 const { data: enrolled } = await db.from('enrollments').select('student_id,support_level').eq('class_id', classId)
 if (!src || !cls) { const e = new Error('That lesson is no longer available.'); e.code = 400; throw e }
 if (!enrolled?.length) { const e = new Error('This class has no students yet.'); e.code = 400; throw e }
 const { data: lesson, error: lErr } = await db.from('lessons').insert({
  class_id: classId, teacher_id: cls.teacher_id, subject: cls.class_name,
  title: src.draft?.plan?.title || src.title || 'Today’s lesson',
  lesson_text: vicTargetText(src.draft), is_active: true, source_lesson_id: src.id,
 }).select('id').single()
 if (lErr) throw lErr
 const at = new Date().toISOString()
 const { error: aErr } = await db.from('assignments').insert(enrolled.map(e => ({
  lesson_id: lesson.id, student_id: e.student_id, mode: toMode(e.support_level), status: 'assigned', assigned_at: at,
 })))
 // Leaving a lesson with no assignments would show the class an empty activity, so undo it.
 if (aErr) { await db.from('lessons').delete().eq('id', lesson.id); throw aErr }
 return { launched: enrolled.length }
}

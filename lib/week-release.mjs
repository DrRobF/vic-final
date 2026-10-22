// "If it's in the week, it's scheduled." A lesson placed on a day of a teacher's week plan goes to
// that class's students at midnight on that day (school time), each at their saved level. Nothing
// to press. Moving the lesson to another day, swapping it, or taking it out changes or removes the
// scheduled copy until the day arrives; after that, what students already have stays put.
//
// The scheduled copy is the same lessons + assignments rows the "Start with my class" button
// writes, with assigned_at set to that midnight. Students only see rows whose time has come
// (lib/release.mjs). VIC reads the lesson's goals live from the saved lesson, so edits made any
// time during the week reach students without re-sending.

import { vicTargetText } from './lesson-companion.mjs'
import { schoolDayStart, schoolToday } from './release.mjs'

const toMode = level => (level === 'remediation' ? 'remediation' : level === 'enrichment' ? 'enrichment' : 'on-level')
const SUBJECT_WORDS = { math: /math/i, reading: /reading|ela|english|language/i }

function weekDates(weekOf) {
 const base = new Date(`${weekOf}T12:00:00Z`)
 return [0, 1, 2, 3, 4].map(i => { const d = new Date(base); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0, 10) })
}

// Which of the teacher's classes this week plan is for: the one the teacher picked, else the one
// whose grade and subject match, else the only class they have.
export function matchClass(classes, week) {
 if (!classes.length) return null
 const picked = Number(week.settings?.classId)
 if (picked && classes.some(c => Number(c.id) === picked)) return classes.find(c => Number(c.id) === picked)
 if (classes.length === 1) return classes[0]
 const grade = week.grade === 'K' ? 0 : Number(week.grade)
 const words = SUBJECT_WORDS[week.subject]
 const fits = classes.filter(c => (c.grade_level == null || Number(c.grade_level) === grade) && (!words || words.test(c.class_name || '')))
 if (fits.length === 1) return fits[0]
 const strict = fits.filter(c => c.grade_level != null)
 return strict.length === 1 ? strict[0] : null
}

// Returns { classId, classes, byDay: [{ status, count }] } where status is
// 'scheduled' | 'live' | 'notReady' | 'noClass' | 'emptyClass' | 'past' | 'none'.
export async function syncWeekReleases(db, { teacherId, row, lessons, now = new Date() }) {
 const days = Array.isArray(row.days) ? row.days : []
 const out = { classId: null, classes: [], byDay: days.map(() => ({ status: 'none', count: 0 })) }
 if (!teacherId || !row.week_of) return out
 const { data: classes } = await db.from('classes').select('id,class_name,grade_level').eq('teacher_id', teacherId).order('id', { ascending: true })
 out.classes = (classes || []).map(c => ({ id: c.id, name: c.class_name }))
 const cls = matchClass(classes || [], row)
 const dates = weekDates(row.week_of), today = schoolToday(now)

 // What the plan wants: one release per future (or today's) planned day.
 const want = []
 days.forEach((d, i) => {
  if (!d?.lessonId || d.off || i > 4) return
  const draft = lessons.get(d.lessonId)
  if (!draft) return
  if (dates[i] < today) { out.byDay[i].status = 'past'; return }
  let text
  try { text = vicTargetText(draft) } catch { out.byDay[i].status = 'notReady'; return }
  if (!cls) { out.byDay[i].status = 'noClass'; return }
  want.push({ i, lessonId: d.lessonId, date: dates[i], at: schoolDayStart(dates[i]), title: draft.plan?.title || 'Today’s lesson', text })
 })
 if (!cls) return out
 out.classId = cls.id

 const { data: enrolled } = await db.from('enrollments').select('student_id,support_level').eq('class_id', cls.id)
 const roster = (enrolled || []).map(r => ({ studentId: r.student_id, mode: toMode(r.support_level) }))

 // Everything already sent from this week's date range to this class.
 const sat = new Date(`${dates[4]}T12:00:00Z`); sat.setUTCDate(sat.getUTCDate() + 1)
 const startAt = schoolDayStart(dates[0]), endAt = schoolDayStart(sat.toISOString().slice(0, 10))
 const { data: existing } = await db.from('lessons')
  .select('id,source_lesson_id,title,lesson_text,assignments!inner(id,student_id,mode,assigned_at)')
  .eq('class_id', cls.id).eq('teacher_id', teacherId).not('source_lesson_id', 'is', null)
  .gte('assignments.assigned_at', startAt).lt('assignments.assigned_at', endAt)
 const rows = (existing || []).map(l => ({ ...l, at: (l.assignments || [])[0]?.assigned_at || null }))
 const nowIso = now.toISOString()
 const unreleased = rows.filter(r => r.at && r.at > nowIso)
 const used = new Set()

 for (const w of want) {
  // Already sent for this day (released or not)?
  let match = rows.find(r => !used.has(r.id) && r.source_lesson_id === w.lessonId && r.at && r.at.slice(0, 10) === w.at.slice(0, 10))
  // Moved from another day this week and not out yet: move it.
  if (!match) match = unreleased.find(r => !used.has(r.id) && r.source_lesson_id === w.lessonId)
  if (match) {
   used.add(match.id)
   if (match.at > nowIso) {
    if (match.at !== w.at) await db.from('assignments').update({ assigned_at: w.at }).eq('lesson_id', match.id)
    if (match.title !== w.title || match.lesson_text !== w.text) await db.from('lessons').update({ title: w.title, lesson_text: w.text }).eq('id', match.id)
    // New students since it was scheduled, and level changes, catch up until release.
    const have = new Map((match.assignments || []).map(a => [Number(a.student_id), a]))
    const add = roster.filter(s => !have.has(Number(s.studentId))).map(s => ({ lesson_id: match.id, student_id: s.studentId, mode: s.mode, status: 'assigned', assigned_at: w.at }))
    if (add.length) await db.from('assignments').insert(add)
    for (const s of roster) { const a = have.get(Number(s.studentId)); if (a && a.mode !== s.mode) await db.from('assignments').update({ mode: s.mode }).eq('id', a.id) }
    out.byDay[w.i] = { status: 'scheduled', count: roster.length }
   } else out.byDay[w.i] = { status: 'live', count: (match.assignments || []).length }
   continue
  }
  if (!roster.length) { out.byDay[w.i].status = 'emptyClass'; continue }
  const { data: lesson, error } = await db.from('lessons').insert({ class_id: cls.id, teacher_id: teacherId, subject: cls.class_name || null, title: w.title, lesson_text: w.text, is_active: true, source_lesson_id: w.lessonId }).select('id').single()
  if (error || !lesson?.id) continue
  const { error: aErr } = await db.from('assignments').insert(roster.map(s => ({ lesson_id: lesson.id, student_id: s.studentId, mode: s.mode, status: 'assigned', assigned_at: w.at })))
  if (aErr) { await db.from('lessons').delete().eq('id', lesson.id); continue }
  out.byDay[w.i] = { status: w.at > nowIso ? 'scheduled' : 'live', count: roster.length }
 }

 // Scheduled copies the plan no longer wants (lesson taken out or swapped) disappear before students see them.
 const stale = unreleased.filter(r => !used.has(r.id)).map(r => r.id)
 if (stale.length) await db.from('lessons').delete().in('id', stale)
 return out
}

import { requireLessonEducator } from '../../../lib/lesson-designer-auth'
import { validLessonId } from '../../../lib/educator-lessons.mjs'
import { buildLessonPacket } from '../../../lib/lesson-packet.mjs'
import { lessonTargets } from '../../../lib/lesson-companion.mjs'
import { lessonPhases } from '../../../lib/lesson-live.mjs'

// Live lesson: everything the teacher needs while the lesson is running, in one response.
// The schedule of activities, the teacher's own materials, what students are looking at,
// and whether the lesson is on students' screens yet.
export default async function handler(req, res) {
 res.setHeader('Cache-Control', 'no-store')
 if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed.' }) }
 try {
  const auth = await requireLessonEducator(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })
  const id = req.query.id
  if (!validLessonId(id)) return res.status(400).json({ error: 'Choose one of your saved lessons.' })
  const db = auth.admin
  const [{ data: lesson, error }, { data: stored }] = await Promise.all([
   db.from('educator_lessons').select('id,title,draft').eq('user_id', auth.user.id).eq('id', id).maybeSingle(),
   db.from('educator_lesson_packets').select('packet').eq('user_id', auth.user.id).eq('lesson_id', id).maybeSingle(),
  ])
  if (error) throw error
  if (!lesson) return res.status(404).json({ error: 'This lesson is not in your account.' })
  const packet = stored?.packet || buildLessonPacket(lesson.draft)
  const { standards, objectives } = lessonTargets(lesson.draft)

  // On students' screens? The most recent copy of this lesson that has reached them.
  let live = null
  if (auth.profile?.id) {
   const nowIso = new Date().toISOString()
   const { data: rows } = await db.from('lessons').select('id,class_id,classes:class_id(class_name),assignments!inner(assigned_at)')
    .eq('source_lesson_id', id).eq('teacher_id', auth.profile.id).lte('assignments.assigned_at', nowIso)
   const best = (rows || []).map(r => ({ r, at: (r.assignments || []).map(a => a.assigned_at).sort().at(-1), n: (r.assignments || []).length })).sort((a, b) => (a.at < b.at ? 1 : -1))[0]
   if (best) live = { className: best.r.classes?.class_name || '', count: best.n, at: best.at }
  }

  return res.json({
   id: lesson.id,
   title: lesson.draft?.plan?.title || lesson.title || 'Today’s lesson',
   minutes: Number(lesson.draft?.input?.minutes) || 0,
   standards, objectives,
   phases: lessonPhases(lesson.draft),
   teacher: (packet.teacher || []).filter(s => s.body),
   student: [...(packet.student || []), ...(packet.supports || [])].filter(s => s.body),
   live,
  })
 } catch (e) {
  console.error('[teacher/live-lesson] failed', { message: e?.message })
  return res.status(500).json({ error: 'Could not open this lesson. Please try again.' })
 }
}

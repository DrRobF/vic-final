import { requireApprovedProfile } from '../../../lib/server-auth'
import { modeLevel, studentWorksheet } from '../../../lib/student-today.mjs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// For the Teach step: every student this lesson was sent to, their level, and their worksheet progress.
export default async function handler(req, res) {
 res.setHeader('Cache-Control', 'no-store')
 if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed.' }) }
 const auth = await requireApprovedProfile(req)
 if (auth.error) return res.status(auth.status).json({ error: auth.error })
 if (auth.profile.role !== 'teacher') return res.status(403).json({ error: 'Only teachers can see student progress.' })
 const lessonId = typeof req.query.lessonId === 'string' && UUID.test(req.query.lessonId) ? req.query.lessonId : ''
 if (!lessonId) return res.status(400).json({ error: 'Invalid lesson link.' })
 const db = auth.admin
 try {
  const { data: src } = await db.from('educator_lessons').select('draft').eq('id', lessonId).eq('user_id', auth.user.id).maybeSingle()
  if (!src) return res.status(404).json({ error: 'This lesson is not in your account.' })
  const { data: sent, error } = await db.from('lessons').select('id,class_id,created_at').eq('source_lesson_id', lessonId).eq('teacher_id', auth.profile.id).order('created_at', { ascending: false }).limit(20)
  if (error) throw error
  const ids = (sent || []).map(l => l.id)
  if (!ids.length) return res.json({ students: [] })
  const [{ data: assigns, error: aErr }, { data: work, error: wErr }] = await Promise.all([
   db.from('assignments').select('lesson_id,student_id,mode,assigned_at').in('lesson_id', ids),
   db.from('student_work').select('lesson_id,student_id,answers,status,updated_at,turned_in_at').in('lesson_id', ids),
  ])
  if (aErr || wErr) throw aErr || wErr
  const studentIds = [...new Set((assigns || []).map(a => a.student_id))]
  const { data: users } = studentIds.length ? await db.from('users').select('id,name').in('id', studentIds) : { data: [] }
  const nameOf = new Map((users || []).map(u => [u.id, u.name]))
  const workOf = new Map((work || []).map(w => [`${w.lesson_id}:${w.student_id}`, w]))
  const sheet = src.draft?.worksheet, groups = src.draft?.input?.groups
  // Latest send per student wins.
  const seen = new Set(), students = []
  for (const a of (assigns || []).sort((x, y) => String(y.assigned_at).localeCompare(String(x.assigned_at)))) {
   if (seen.has(a.student_id)) continue
   seen.add(a.student_id)
   const w = workOf.get(`${a.lesson_id}:${a.student_id}`)
   const version = studentWorksheet(sheet, a.mode, groups)
   const full = version ? sheet.versions[version.index] : null
   students.push({
    name: nameOf.get(a.student_id) || 'Student',
    level: modeLevel(a.mode),
    sentAt: a.assigned_at,
    status: w ? w.status : 'not_started',
    updatedAt: w?.updated_at || null,
    questions: version ? version.questions.map((q, i) => ({ prompt: q.prompt, answer: full?.questions?.[i]?.answer || '', response: w?.answers?.[i] || '' })) : [],
   })
  }
  students.sort((x, y) => x.name.localeCompare(y.name))
  return res.json({ students })
 } catch (e) {
  console.error('Lesson progress failed', { message: e?.message })
  return res.status(500).json({ error: 'Could not load student progress.' })
 }
}

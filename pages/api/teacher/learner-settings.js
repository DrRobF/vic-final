import { requireLessonEducator } from '../../../lib/lesson-designer-auth'
import { isLeader } from '../../../lib/vic-room.mjs'
import { permissionsFor, parseSettings, refusedChanges, SUBJECTS, ALTERNATE_STANDARDS_HELP } from '../../../lib/learner-settings.mjs'

// How VIC teaches one child: their working level per subject, and the supports they are given.
// GET  ?studentId=  -> what is set now, and what this adult may change
// POST {studentId, levels?, supports?} -> change it
//
// The working level is separate from the child's enrolled grade. A Grade 6 student working at
// Grade 1 keeps her place on the roster; this only changes what VIC teaches her.
// Rules about who may change what live in lib/learner-settings.mjs.
export default async function handler(req, res) {
 res.setHeader('Cache-Control', 'no-store')
 if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed.' }) }
 const auth = await requireLessonEducator(req)
 if (auth.error) return res.status(auth.status).json({ error: auth.error })
 // A free Lesson Designer account has no school and no students.
 if (!auth.profile?.id) return res.status(403).json({ error: 'This is for school staff.' })
 const db = auth.admin
 const studentId = Number(req.method === 'GET' ? req.query.studentId : req.body?.studentId)
 if (!Number.isInteger(studentId) || studentId <= 0) return res.status(400).json({ error: 'Choose a student.' })

 try {
  const { data: student } = await db.from('users').select('id,name,role,grade_level').eq('id', studentId).maybeSingle()
  // Answer "not found" for anything that is not a student, so this cannot be used to probe staff accounts.
  if (!student || student.role !== 'student') return res.status(404).json({ error: 'Student not found.' })

  const leader = await isLeader(db, auth.user.id)
  let teaches = false
  if (!leader) {
   const { data: mine } = await db.from('classes').select('id').eq('teacher_id', auth.profile.id)
   const ids = (mine || []).map(c => c.id)
   if (ids.length) {
    const { data: enrolled } = await db.from('enrollments').select('id').eq('student_id', studentId).in('class_id', ids).limit(1)
    teaches = !!enrolled?.length
   }
  }
  const perms = permissionsFor({ leader, teaches })
  if (!perms.level) return res.status(403).json({ error: 'This student isn’t in one of your classes.' })

  const read = async () => {
   const [{ data: levels }, { data: supports }] = await Promise.all([
    db.from('student_levels').select('subject,level,source,confirmed_at,updated_at').eq('student_id', studentId),
    db.from('student_supports').select('read_aloud,language,alternate_standards,updated_at').eq('student_id', studentId).maybeSingle(),
   ])
   const bySubject = Object.fromEntries(SUBJECTS.map(s => [s, null]))
   for (const l of levels || []) bySubject[l.subject] = { level: l.level, source: l.source, confirmed: !!l.confirmed_at }
   return {
    student: { id: student.id, name: student.name, enrolledGrade: student.grade_level },
    levels: bySubject,
    supports: { read_aloud: 'off', language: 'en', alternate_standards: false, ...(supports || {}) },
    can: { level: perms.level, alternateStandards: perms.alternateStandards },
    help: perms.alternateStandards ? '' : ALTERNATE_STANDARDS_HELP,
   }
  }

  if (req.method === 'GET') return res.json(await read())

  const parsed = parseSettings(req.body)
  if (!parsed.ok) return res.status(400).json({ error: parsed.errors[0], errors: parsed.errors })
  const before = await read()
  const refused = refusedChanges(parsed, perms, before.supports)
  if (refused.length) return res.status(403).json({ error: `You can’t change ${refused.join(' or ')} for this student.${refused.includes('alternate standards') ? ` ${ALTERNATE_STANDARDS_HELP}` : ''}` })

  const now = new Date().toISOString()
  for (const [subject, level] of Object.entries(parsed.levels)) {
   if (level === null) {
    // Back to the enrolled grade. Deliberate, so it is a real delete rather than a level of "none".
    const { error } = await db.from('student_levels').delete().eq('student_id', studentId).eq('subject', subject)
    if (error) throw error
   } else {
    // A human chose this number, so it is confirmed. VIC-proposed levels would arrive unconfirmed.
    const { error } = await db.from('student_levels').upsert({ student_id: studentId, subject, level, source: 'teacher', set_by: auth.user.id, confirmed_at: now, updated_at: now }, { onConflict: 'student_id,subject' })
    if (error) throw error
   }
  }
  if (Object.keys(parsed.supports).length) {
   const { error } = await db.from('student_supports').upsert({ student_id: studentId, ...parsed.supports, set_by: auth.user.id, updated_at: now }, { onConflict: 'student_id' })
   if (error) throw error
  }
  return res.json(await read())
 } catch (e) {
  console.error('[teacher/learner-settings] failed', { message: e?.message })
  return res.status(500).json({ error: 'Could not save. Please try again.' })
 }
}

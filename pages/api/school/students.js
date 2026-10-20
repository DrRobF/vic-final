import { requirePrincipal, requireSchool } from '../../../lib/assistant-principal-auth'
import { kidPassword } from '../../../lib/kid-password.mjs'

// Every student and the username they log in with, in one place.
//
// This was spread across three screens before: classroom rosters showed usernames one
// class at a time, and the accounts page needed a search. A principal asking "what is
// Johnny's login?" should not have to hunt.
//
// SCOPING NOTE: AskVic has one school today, and students are not tied to a school --
// only to classes, and classes only to a teacher. So this returns every student. Before
// a second school is onboarded this must be narrowed to the school's own classes, or one
// school's leader would see another's children.

export const config = { api: { bodyParser: { sizeLimit: '8kb' } } }

const username = email => String(email || '').split('@')[0] || ''

export default async function handler(req, res) {
 res.setHeader('Cache-Control', 'no-store')
 if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed.' }) }
 try {
  const auth = await requirePrincipal(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })
  const schoolId = req.method === 'GET' ? req.query.schoolId : req.body?.schoolId
  if (!schoolId) return res.status(400).json({ error: 'Choose a school.' })
  const school = await requireSchool(auth, schoolId)
  if (school.error) return res.status(school.status).json({ error: school.error })

  const db = auth.admin

  // A password cannot be looked up -- Supabase stores a hash, which is how it should be.
  // So the only honest answer to "what is Johnny's password" is to set a new one and show
  // it once. Readable words a child can type, never a random string.
  if (req.method === 'POST') {
   if (req.body?.action !== 'reset_password') return res.status(400).json({ error: 'Unknown action.' })
   const id = Number(req.body?.studentId)
   if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'Choose a student.' })
   const { data: student, error: findErr } = await db.from('users').select('id,name,email,role,auth_user_id').eq('id', id).maybeSingle()
   if (findErr) throw findErr
   if (!student || String(student.role).toLowerCase() !== 'student') return res.status(404).json({ error: 'That is not a student account.' })
   if (!student.auth_user_id) return res.status(409).json({ error: 'That student has no login yet.' })
   const password = kidPassword()
   // Students keep the password they are given: no child should meet a "choose a new
   // password" screen on their way into a lesson.
   const { data: existing } = await db.auth.admin.getUserById(student.auth_user_id)
   const done = await db.auth.admin.updateUserById(student.auth_user_id, {
    password,
    app_metadata: { ...(existing?.user?.app_metadata || {}), must_change_password: false, password_reset_by: auth.user.id, password_reset_at: new Date().toISOString() },
   })
   if (done.error) return res.status(503).json({ error: 'Could not reset that password. Please try again.' })
   return res.json({ success: true, name: student.name || '', username: String(student.email || '').split('@')[0], password })
  }
  const [{ data: students, error: sErr }, { data: classes, error: cErr }, { data: enrols, error: eErr }] = await Promise.all([
   db.from('users').select('id,name,email,parent_email').eq('role', 'student').order('name').limit(2000),
   db.from('classes').select('id,class_name,class_code,teacher_id').limit(500),
   db.from('enrollments').select('student_id,class_id').limit(20000),
  ])
  if (sErr || cErr || eErr) throw sErr || cErr || eErr

  const { data: teachers } = await db.from('users').select('id,name').in('role', ['teacher', 'principal']).limit(1000)
  const teacherName = new Map((teachers || []).map(t => [t.id, t.name]))
  const classById = new Map((classes || []).map(c => [c.id, { name: c.class_name, code: c.class_code, teacher: teacherName.get(c.teacher_id) || '' }]))
  const byStudent = new Map()
  for (const e of enrols || []) {
   const c = classById.get(e.class_id)
   if (!c) continue
   if (!byStudent.has(e.student_id)) byStudent.set(e.student_id, [])
   byStudent.get(e.student_id).push(c)
  }

  return res.json({
   students: (students || []).map(s => ({
    id: s.id,
    name: s.name || '',
    username: username(s.email),
    parentEmail: s.parent_email || '',
    classes: (byStudent.get(s.id) || []).map(c => ({ name: c.name, code: c.code, teacher: c.teacher })),
   })),
  })
 } catch { return res.status(503).json({ error: 'Could not read your student list. Please try again.' }) }
}

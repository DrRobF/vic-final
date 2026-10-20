import { requirePrincipal, requireSchool } from '../../../lib/assistant-principal-auth'

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
 if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed.' }) }
 try {
  const auth = await requirePrincipal(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })
  const schoolId = req.query.schoolId
  if (!schoolId) return res.status(400).json({ error: 'Choose a school.' })
  const school = await requireSchool(auth, schoolId)
  if (school.error) return res.status(school.status).json({ error: school.error })

  const db = auth.admin
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

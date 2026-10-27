import { requireApprovedProfile } from '../../../lib/server-auth'
import general from '../../../data/lesson-standards.json'
import access from '../../../data/access-points.json'
import { startPractice } from '../../../lib/vic-practice.mjs'

// VIC practice path: the next skill for this student in this class, at their own level.
// The picking lives in lib/vic-practice.mjs because the VIC Room starts the same thing for a
// whole group when no teacher has planned a lesson.
export default async function handler(req, res) {
 res.setHeader('Cache-Control', 'no-store')
 if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed.' }) }
 const auth = await requireApprovedProfile(req)
 if (auth.error) return res.status(auth.status).json({ error: auth.error })
 if (auth.profile.role !== 'student') return res.status(403).json({ error: 'Practice is for students.' })
 const classId = Number(req.body?.classId)
 const subject = ['math', 'reading'].includes(req.body?.subject) ? req.body.subject : null
 if (!Number.isInteger(classId)) return res.status(400).json({ error: 'Choose a class.' })
 try {
  const out = await startPractice(auth.admin, { studentId: auth.profile.id, classId, subject, catalogues: { general, access } })
  if (out.error) return res.status(400).json({ error: out.error })
  return res.json(out)
 } catch (e) {
  console.error('[student/practice] failed', { message: e?.message })
  return res.status(500).json({ error: 'Could not start practice. Please try again.' })
 }
}

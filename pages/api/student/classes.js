import { requireApprovedProfile } from '../../../lib/server-auth'
import { mapStudentEnrollments } from '../../../lib/student-class-access.mjs'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed.' })
  }

  const auth = await requireApprovedProfile(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })
  if (auth.profile.role !== 'student') {
    return res.status(403).json({ error: 'Only students may load student classes.' })
  }

  // The student id is intentionally taken only from the profile resolved by
  // auth.uid() -> public.users.auth_user_id. No caller-supplied id is trusted.
  const { data, error } = await auth.admin
    .from('enrollments')
    .select('class_id, support_level, classes:class_id(id, class_name, class_code, grade_level)')
    .eq('student_id', auth.profile.id)
    .order('class_id', { ascending: true })

  if (error) return res.status(500).json({ error: 'Could not load your classes.' })

  return res.status(200).json({
    profile: {
      id: auth.profile.id,
      name: auth.profile.name,
      email: auth.profile.email,
      role: auth.profile.role,
      interest_tags: auth.profile.interest_tags,
    },
    classes: mapStudentEnrollments(data),
  })
}

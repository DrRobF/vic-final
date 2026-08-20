import { requireApprovedProfile } from '../../../lib/server-auth'

export default async function handler(req, res) {
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed.' })
  const auth = await requireApprovedProfile(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })
  if (auth.profile.role !== 'student') return res.status(403).json({ error: 'Student account required.' })

  const interest = typeof req.body?.interest === 'string'
    ? req.body.interest.replace(/[<>]/g, '').trim().replace(/\s+/g, ' ').slice(0, 120)
    : ''
  if (!interest) return res.status(400).json({ error: 'Please enter an interest.' })
  const { error } = await auth.admin.from('users').update({ interest_tags: interest ? [interest] : [] }).eq('id', auth.profile.id)
  if (error) return res.status(500).json({ error: 'Could not save your interest.' })
  return res.status(200).json({ saved: true, interest })
}

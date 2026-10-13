import { requireLessonEducator } from '../../../lib/lesson-designer-auth'
import { validLessonId } from '../../../lib/educator-lessons.mjs'
import { updateSteps } from '../../../lib/lesson-steps.mjs'
export const config = { api: { bodyParser: { sizeLimit: '4kb' } } }

// Marks Print / Teach / Follow up done (or not) on one of the teacher's own saved lessons.
export default async function handler(req, res) {
 res.setHeader('Cache-Control', 'no-store')
 if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed.' }) }
 const auth = await requireLessonEducator(req)
 if (auth.error) return res.status(auth.status).json({ error: auth.error })
 const { lessonId, step, done } = req.body || {}
 if (!validLessonId(lessonId)) return res.status(400).json({ error: 'Choose a saved lesson.' })
 const { data: row, error } = await auth.admin.from('educator_lessons').select('draft').eq('user_id', auth.user.id).eq('id', lessonId).maybeSingle()
 if (error) return res.status(503).json({ error: 'Could not open this lesson. Please retry.' })
 if (!row) return res.status(404).json({ error: 'This lesson is not in your account.' })
 let steps
 try { steps = updateSteps(row.draft?.steps, step, done !== false) } catch (e) { return res.status(400).json({ error: e.message }) }
 const { error: saveError } = await auth.admin.from('educator_lessons').update({ draft: { ...row.draft, steps } }).eq('user_id', auth.user.id).eq('id', lessonId)
 if (saveError) return res.status(503).json({ error: 'Could not save this step. Please retry.' })
 return res.json({ steps })
}

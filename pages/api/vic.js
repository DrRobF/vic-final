import { requireApprovedProfile } from '../../lib/server-auth'
import {
  buildVicContext,
  normalizeSessionMode,
  selectActiveAssignment,
  selectActiveEnrollment,
  TEACHER_DIRECTED,
} from '../../lib/ask-vic-context.mjs'

export const config = { api: { bodyParser: { sizeLimit: '8mb' } } }

const cleanInterest = (value) => typeof value === 'string' ? value.trim().slice(0, 120) : ''

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })

  const { messages, sketchImage, sessionMode, studentId, activeClassId } = req.body || {}
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Send at least one message.' })
  }

  const auth = await requireApprovedProfile(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })

  const mode = normalizeSessionMode(sessionMode)
  const requestedStudentId = Number(studentId)
  if (auth.profile.role !== 'student') {
    return res.status(403).json({ error: 'Ask VIC student sessions require a student account.' })
  }
  if (Number.isFinite(requestedStudentId) && requestedStudentId !== auth.profile.id) {
    return res.status(403).json({ error: 'You may only access your own learning session.' })
  }

  try {
    const savedInterest = Array.isArray(auth.profile.interest_tags)
      ? auth.profile.interest_tags.map(cleanInterest).filter(Boolean).join(', ').slice(0, 120)
      : ''
    let context

    if (mode === TEACHER_DIRECTED) {
      const { data: enrollments, error: enrollmentError } = await auth.admin
        .from('enrollments')
        .select('class_id, support_level, classes:class_id(id, grade_level)')
        .eq('student_id', auth.profile.id)
        .order('class_id', { ascending: true })
      if (enrollmentError) throw enrollmentError

      const enrollment = selectActiveEnrollment(enrollments, activeClassId)
      if (!enrollment) {
        return res.status(403).json({ error: 'Teacher Lesson is unavailable for the selected class.' })
      }

      // Deliberately use only columns present in the production assignment schema. The old
      // teacher-directed path selected/ordered by created_at, causing the request to fail
      // before OpenAI even ran on deployments where that optional column is absent.
      const { data: assignments, error: assignmentError } = await auth.admin
        .from('assignments')
        .select('id, lesson_id, class_id, mode, status, assigned_at')
        .eq('student_id', auth.profile.id)
        .eq('class_id', enrollment.class_id)
        .order('assigned_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false })
        .limit(20)
      if (assignmentError) throw assignmentError

      const assignment = selectActiveAssignment(assignments, enrollment)
      if (!assignment?.lesson_id) {
        return res.status(409).json({ error: 'No active teacher lesson is available for the selected class.' })
      }

      const { data: lessons, error: lessonError } = await auth.admin
        .from('lessons')
        .select('id, subject, title, lesson_text, is_active')
        .eq('id', assignment.lesson_id)
        .limit(1)
      if (lessonError) throw lessonError
      const lesson = lessons?.[0] || null
      const classRow = Array.isArray(enrollment.classes) ? enrollment.classes[0] : enrollment.classes
      context = buildVicContext({
        mode,
        lesson,
        assignmentMode: assignment.mode,
        supportLevel: enrollment.support_level,
        interest: savedInterest,
        gradeLevel: classRow?.grade_level,
      })
      if (!context) {
        return res.status(409).json({ error: 'The assigned lesson is not available right now. Please ask your teacher.' })
      }
    } else {
      // Assignment data is never queried or added to My Own Work context.
      context = buildVicContext({ mode, interest: savedInterest })
    }

    const safeMessages = messages
      .filter((message) => message && ['user', 'assistant'].includes(message.role))
      .map((message) => ({ role: message.role, content: typeof message.content === 'string' ? message.content : '' }))
    const input = [{ role: 'system', content: context }, ...safeMessages]
    if (typeof sketchImage === 'string' && sketchImage.startsWith('data:image/') && input.at(-1)?.role === 'user') {
      input[input.length - 1] = {
        role: 'user',
        content: [
          { type: 'input_text', text: input.at(-1).content },
          { type: 'input_image', image_url: sketchImage, detail: 'high' },
        ],
      }
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        prompt: { id: 'pmpt_69c52eb12f388194824e58a741a7c6cb0becb3343e16f10b' },
        input,
      }),
    })

    const data = await response.json().catch(() => null)
    if (!response.ok) {
      console.error('VIC provider request failed.', { status: response.status, mode })
      return res.status(502).json({ error: 'VIC could not respond right now. Please try again.' })
    }

    const reply = data?.output_text || data?.output?.[0]?.content?.[0]?.text
    if (!reply) return res.status(502).json({ error: 'VIC returned an empty response. Please try again.' })
    return res.status(200).json({ reply })
  } catch (error) {
    console.error('VIC request failed.', { name: error?.name, mode })
    return res.status(500).json({ error: 'VIC could not load this learning session. Please try again.' })
  }
}

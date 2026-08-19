import { requireApprovedProfile } from '../../lib/server-auth'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '8mb',
    },
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    messages,
    sketchImage,
    sessionMode,
    studentId,
    activeClassId,
    studentInterest,
    entryIntent,
    isFirstUserTurn,
  } = req.body || {}

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Missing messages array' })
  }

  const auth = await requireApprovedProfile(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })

  const normalizeSupportLevel = (rawLevel) => {
    if (typeof rawLevel !== 'string') return ''

    const value = rawLevel.trim().toLowerCase()

    if (value === 'on-level' || value === 'on_level') return 'core'
    if (value === 'remediation' || value === 'core' || value === 'enrichment') return value

    return ''
  }

  const normalizeSessionMode = (rawMode) => {
    if (typeof rawMode !== 'string') return 'student_directed'
    const normalized = rawMode.trim().toLowerCase()
    return normalized === 'teacher_directed' ? 'teacher_directed' : 'student_directed'
  }

  const cleanLessonField = (value) => (typeof value === 'string' ? value.trim() : '')

  const getTeacherLessonAvailability = (lesson) => {
    const title = cleanLessonField(lesson?.title)
    const lessonText = cleanLessonField(lesson?.lesson_text)
    return {
      title,
      lessonText,
      hasLessonText: Boolean(lessonText),
    }
  }

  try {
    let resolvedSessionMode = normalizeSessionMode(sessionMode)
    const requestedStudentId = Number(studentId)
    if (auth.profile.role === 'student' && requestedStudentId && requestedStudentId !== auth.profile.id) {
      return res.status(403).json({ error: 'Students may only use their own VIC profile.' })
    }
    if (auth.profile.role === 'teacher' && (resolvedSessionMode === 'teacher_directed' || requestedStudentId)) {
      return res.status(403).json({ error: 'Teachers cannot impersonate student VIC sessions.' })
    }

    const resolvedStudentId = auth.profile.role === 'student' ? auth.profile.id : null
    let resolvedAssignedLesson = null
    let resolvedStudentMode = ''
    let resolvedSupportLevel = ''
    let resolvedStudentInterest = resolvedSessionMode === 'student_directed' && typeof studentInterest === 'string'
      ? studentInterest.trim().slice(0, 120)
      : ''
    let resolvedGradeLevel = ''

    if (auth.profile.role !== 'student') resolvedSessionMode = 'student_directed'
    if (resolvedSessionMode === 'teacher_directed') {
      const { data: enrollments, error: enrollmentError } = await auth.admin
        .from('enrollments')
        .select('class_id, support_level, classes:class_id(id, grade_level)')
        .eq('student_id', resolvedStudentId)
        .order('class_id', { ascending: true })
      if (enrollmentError) throw enrollmentError
      const requestedClassId = Number(activeClassId)
      const enrollment = enrollments?.find((row) => Number(row.class_id) === requestedClassId) || enrollments?.[0]
      const classRow = Array.isArray(enrollment?.classes) ? enrollment.classes[0] : enrollment?.classes

      const { data: assignments, error: assignmentError } = await auth.admin
        .from('assignments')
        .select('id, lesson_id, mode, assigned_at, created_at')
        .eq('student_id', resolvedStudentId)
        .order('assigned_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false })
        .limit(20)
      if (assignmentError) throw assignmentError
      const assignment = enrollment?.support_level
        ? assignments?.find((row) => normalizeSupportLevel(row.mode) === normalizeSupportLevel(enrollment.support_level)) || assignments?.[0]
        : assignments?.[0]
      if (assignment?.lesson_id) {
        const { data: lessons, error: lessonError } = await auth.admin
          .from('lessons').select('id, subject, title, lesson_text, is_active')
          .eq('id', assignment.lesson_id).limit(1)
        if (lessonError) throw lessonError
        resolvedAssignedLesson = lessons?.[0] || null
      }
      resolvedStudentMode = assignment?.mode || ''
      resolvedSupportLevel = normalizeSupportLevel(enrollment?.support_level || assignment?.mode || '')
      resolvedStudentInterest = Array.isArray(auth.profile.interest_tags) ? auth.profile.interest_tags.join(', ') : ''
      resolvedGradeLevel = classRow?.grade_level == null ? '' : String(classRow.grade_level)
    }

    const contextMessages = []

    const normalizedEntryIntent = typeof entryIntent === 'string' ? entryIntent.trim().toLowerCase() : ''
    const shouldGuideFirstResponse = Boolean(isFirstUserTurn && resolvedSessionMode !== 'teacher_directed')

    if (shouldGuideFirstResponse) {
      const guidedStartInstruction = `
FIRST-RESPONSE GUIDANCE:
- Sound like a calm co-teacher, not a generic chatbot.
- Start with one short orientation sentence about what you'll do next.
- Then give one immediate, practical next step.
- Keep it concise and student-friendly.

ENTRY INTENT:
${normalizedEntryIntent || 'student_typed_freeform'}

INTENT-SPECIFIC TONE:
- homework_help: diagnose quickly, then coach the student through their current task.
- start_lesson: frame a clear learning target and begin instruction.
- practice_skill: offer a short practice prompt and coach live with feedback.
- student_typed_freeform: infer the likely need and begin with structured guidance.
`

      contextMessages.push({
        role: 'system',
        content: guidedStartInstruction,
      })
    }

    const teacherLessonAvailability = getTeacherLessonAvailability(resolvedAssignedLesson)
    const teacherLessonContextApplied =
      resolvedSessionMode === 'teacher_directed' && teacherLessonAvailability.hasLessonText

    if (teacherLessonContextApplied) {
      const lessonContext = `
TEACHER-ASSIGNED SESSION CONTEXT:
- Session mode: teacher_directed
- The teacher has already chosen the lesson focus and this is the source of truth.
- Start the assigned lesson immediately.
- Keep VIC's existing teaching style, pacing, interest integration, and one-step-at-a-time behavior.

ASSIGNED LESSON:
Subject: ${resolvedAssignedLesson.subject || ''}
Title: ${teacherLessonAvailability.title || 'Untitled teacher-assigned lesson'}
Lesson Text (primary source of truth): ${teacherLessonAvailability.lessonText}

STUDENT SUPPORT MODE:
${resolvedStudentMode || ''}

STUDENT SUPPORT LEVEL:
${resolvedSupportLevel || 'core'}

SUPPORT LEVEL TEACHING BEHAVIOR:
- remediation: slower pacing, more scaffolding, step-by-step guidance, and frequent checks for understanding.
- core: standard teaching pace and support.
- enrichment: faster pacing, deeper thinking, and additional challenge/extension.

STUDENT INTEREST:
${resolvedStudentInterest || ''}

STUDENT GRADE LEVEL:
${resolvedGradeLevel || ''}

IMPORTANT:
- Do not ask onboarding questions (including personal-interest starters) in teacher_directed mode.
- Teach the assigned lesson instead of generic chat.
- Do not replace the lesson topic from student messages.
- Use the assigned lesson text as the primary teaching source; interests only personalize examples.
- If the student asks for a different topic, acknowledge briefly and redirect to this assigned lesson unless they switch to My Own Work.
- Adapt instruction to the support level behavior above.
`

      contextMessages.push({
        role: 'system',
        content: lessonContext,
      })
    }

    if (resolvedStudentInterest) {
      const interestPersonalizationContext =
        resolvedSessionMode === 'teacher_directed'
          ? `
INTEREST PERSONALIZATION (TEACHER LESSON PROTECTION):
- Student interest for examples/metaphors only: ${resolvedStudentInterest}
- Keep the teacher-assigned lesson topic as the source of truth.
- Never switch or replace the lesson topic because of interest.
`
          : `
INTEREST PERSONALIZATION (STUDENT DIRECTED):
- Student interest for optional personalization only: ${resolvedStudentInterest}
- Use it to shape examples, analogies, and scenarios when helpful.
- Keep the student's actual question and requested task as primary.
- Do not force a lesson topic from the interest alone.
`

      contextMessages.push({
        role: 'system',
        content: interestPersonalizationContext,
      })
    }

    if (resolvedSessionMode === 'teacher_directed' && !teacherLessonAvailability.hasLessonText) {
      return res.status(200).json({
        reply: 'Your teacher assigned a lesson, but the lesson details are unavailable right now.',
        debug: {
          studentId: resolvedStudentId,
          sessionMode: resolvedSessionMode,
          teacherLessonContextApplied: false,
          assignedLessonTitle: teacherLessonAvailability.title || null,
          studentMode: resolvedStudentMode || null,
          supportLevel: resolvedSupportLevel || null,
          studentInterest: resolvedStudentInterest || null,
          gradeLevel: resolvedGradeLevel || null,
          entryIntent: normalizedEntryIntent || null,
          isFirstUserTurn: shouldGuideFirstResponse,
          teacherLessonUnavailable: true,
        },
      })
    }

    const combinedMessages = [...contextMessages, ...messages]

    const input = combinedMessages.map((msg, index) => {
      const isLastUserMessage =
        index === combinedMessages.length - 1 && msg.role === 'user'

      if (
        isLastUserMessage &&
        typeof sketchImage === 'string' &&
        sketchImage.startsWith('data:image/')
      ) {
        return {
          role: msg.role,
          content: [
            {
              type: 'input_text',
              text: typeof msg.content === 'string' ? msg.content : '',
            },
            {
              type: 'input_image',
              image_url: sketchImage,
              detail: 'high',
            },
          ],
        }
      }

      return msg
    })

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        prompt: {
          id: 'pmpt_69c52eb12f388194824e58a741a7c6cb0becb3343e16f10b',
        },
        input,
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      console.error('OpenAI API request failed.', { status: response.status })
      return res.status(response.status).json({
        error: data?.error?.message || 'OpenAI request failed',
      })
    }

    const reply =
      data.output_text ||
      data.output?.[0]?.content?.[0]?.text ||
      'Sorry, I had trouble responding.'

    return res.status(200).json({
      reply,
    })
  } catch (err) {
    console.error('VIC API ERROR:', err)
    return res.status(500).json({ error: 'Server error' })
  }
}

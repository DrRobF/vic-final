export const config = {
  api: {
    bodyParser: {
      sizeLimit: '8mb',
    },
  },
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    messages,
    sketchImage,
    sessionMode,
    studentId,
    assignedLesson,
    studentMode,
    studentInterest,
  } = req.body || {}

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Missing messages array' })
  }

  try {
       const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

    let resolvedSessionMode = sessionMode || 'student_directed'
    let resolvedAssignedLesson = assignedLesson || null
    let resolvedStudentMode = studentMode || ''
    let resolvedStudentInterest = studentInterest || ''
    let resolvedGradeLevel = ''

    const resolvedStudentId =
      typeof studentId === 'number'
        ? studentId
        : typeof studentId === 'string' && studentId.trim()
          ? Number(studentId)
          : null

    // If a student id is provided and lesson context was not passed in,
    // fetch the most recent assignment and joined lesson automatically.
    if (
      !resolvedAssignedLesson &&
      resolvedStudentId &&
      supabaseUrl &&
      supabaseKey
    ) {
      try {
        // Get latest assignment for this student
        const assignmentRes = await fetch(
          `${supabaseUrl}/rest/v1/assignments?student_id=eq.${resolvedStudentId}&select=id,lesson_id,student_id,mode,status,assigned_at&order=assigned_at.desc&limit=1`,
          {
            method: 'GET',
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
          }
        )

        const assignmentData = await assignmentRes.json()

        if (assignmentRes.ok && Array.isArray(assignmentData) && assignmentData.length > 0) {
          const assignment = assignmentData[0]

          // Get the linked lesson
          const lessonRes = await fetch(
            `${supabaseUrl}/rest/v1/lessons?id=eq.${assignment.lesson_id}&select=id,subject,title,lesson_text,is_active&limit=1`,
            {
              method: 'GET',
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
              },
            }
          )

          const lessonData = await lessonRes.json()

          // Get student interest
          const studentRes = await fetch(
            `${supabaseUrl}/rest/v1/users?id=eq.${resolvedStudentId}&select=id,interest_tags&limit=1`,
            {
              method: 'GET',
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
              },
            }
          )

          const studentData = await studentRes.json()

          if (lessonRes.ok && Array.isArray(lessonData) && lessonData.length > 0) {
            resolvedAssignedLesson = lessonData[0]
            resolvedStudentMode = assignment.mode || ''

            if (studentRes.ok && Array.isArray(studentData) && studentData.length > 0) {
              const interestTags = studentData[0]?.interest_tags
              resolvedStudentInterest = Array.isArray(interestTags)
                ? interestTags.join(', ')
                : ''
            }

            const enrollmentRes = await fetch(
              `${supabaseUrl}/rest/v1/enrollments?student_id=eq.${resolvedStudentId}&select=class_id,classes:class_id(id,class_name,grade_level)&limit=1`,
              {
                method: 'GET',
                headers: {
                  apikey: supabaseKey,
                  Authorization: `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json',
                },
              }
            )

            const enrollmentData = await enrollmentRes.json()
            const enrollmentRow = Array.isArray(enrollmentData) ? enrollmentData[0] : null
            const classRow = Array.isArray(enrollmentRow?.classes)
              ? enrollmentRow.classes[0]
              : enrollmentRow?.classes

            if (enrollmentRes.ok && classRow?.grade_level) {
              resolvedGradeLevel = String(classRow.grade_level)
            }
          }
        } else {
          console.log('No assignment found or assignments blocked by RLS:', assignmentData)
        }
      } catch (dbError) {
        console.error('Supabase lookup error:', dbError)
      }
    }

    const contextMessages = []

    if (resolvedAssignedLesson) {
      resolvedSessionMode = 'teacher_directed'
      const lessonContext = `
TEACHER-ASSIGNED SESSION CONTEXT:
- Session mode: teacher_directed
- Do not run the normal multi-step lesson entry unless key information is missing.
- The teacher has already chosen the lesson focus.
- Use the assigned lesson immediately.
- Keep VIC's existing teaching style, pacing, interest integration, and one-step-at-a-time behavior.

ASSIGNED LESSON:
Subject: ${resolvedAssignedLesson.subject || ''}
Title: ${resolvedAssignedLesson.title || ''}
Lesson: ${resolvedAssignedLesson.lesson_text || ''}

STUDENT SUPPORT MODE:
${resolvedStudentMode || ''}

STUDENT INTEREST:
${resolvedStudentInterest || ''}

STUDENT GRADE LEVEL:
${resolvedGradeLevel || ''}

IMPORTANT:
- If student interest is already known, do not ask for it again.
- Begin by teaching the assigned lesson directly.
- Teach the assigned lesson instead of generic chat.
- Adapt instruction to the support mode.
`

      contextMessages.push({
        role: 'system',
        content: lessonContext,
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
      console.error('OpenAI API error:', data)
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
      debug: {
        studentId: resolvedStudentId,
        sessionMode: resolvedSessionMode,
        assignedLessonTitle: resolvedAssignedLesson?.title || null,
        studentMode: resolvedStudentMode || null,
        studentInterest: resolvedStudentInterest || null,
        gradeLevel: resolvedGradeLevel || null,
      },
    })
  } catch (error) {
    console.error('Server error:', error)
    return res.status(500).json({ error: 'Server error' })
  }
}

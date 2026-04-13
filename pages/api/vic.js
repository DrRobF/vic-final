export const config = {
  api: {
    bodyParser: {
      sizeLimit: '8mb',
    },
  },
}

const CURRENT_STUDENT_ID = 2

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
    assignedLesson,
    studentMode,
    studentInterest,
  } = req.body || {}

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Missing messages array' })
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

    let resolvedSessionMode = sessionMode || 'student_directed'
    let resolvedAssignedLesson = assignedLesson || null
    let resolvedStudentMode = studentMode || ''
    let resolvedStudentInterest = studentInterest || ''

    // If the frontend did not send a teacher-directed lesson,
    // try loading one directly from Supabase for the current student.
    if (!resolvedAssignedLesson && supabaseUrl && supabaseKey) {
      try {
        // 1) Get latest assignment for the student
        const assignmentRes = await fetch(
          `${supabaseUrl}/rest/v1/assignments?student_id=eq.${CURRENT_STUDENT_ID}&select=id,lesson_id,student_id,mode,status,assigned_at&order=assigned_at.desc&limit=1`,
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

          // 2) Get the linked lesson
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

          // 3) Get student interest
          const studentRes = await fetch(
            `${supabaseUrl}/rest/v1/users?id=eq.${CURRENT_STUDENT_ID}&select=id,interest_tags&limit=1`,
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
            resolvedSessionMode = 'teacher_directed'

            if (studentRes.ok && Array.isArray(studentData) && studentData.length > 0) {
              const interestTags = studentData[0]?.interest_tags
              resolvedStudentInterest = Array.isArray(interestTags)
                ? interestTags.join(', ')
                : ''
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

    // Only add teacher-directed lesson context when a lesson is actually assigned
    if (resolvedSessionMode === 'teacher_directed' && resolvedAssignedLesson) {
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

IMPORTANT:
- If student interest is already known, do not ask for it again.
- Begin by teaching the assigned lesson directly.
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
        sessionMode: resolvedSessionMode,
        assignedLessonTitle: resolvedAssignedLesson?.title || null,
        studentMode: resolvedStudentMode || null,
        studentInterest: resolvedStudentInterest || null,
      },
    })
  } catch (error) {
    console.error('Server error:', error)
    return res.status(500).json({ error: 'Server error' })
  }
}

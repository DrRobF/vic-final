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
    assignedLesson,
    studentMode,
    studentInterest,
  } = req.body || {}

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Missing messages array' })
  }

  try {
    const contextMessages = []

    // Only add teacher-directed lesson context when a lesson is actually assigned
    if (sessionMode === 'teacher_directed' && assignedLesson) {
      const lessonContext = `
TEACHER-ASSIGNED SESSION CONTEXT:
- Session mode: teacher_directed
- Do not run the normal multi-step lesson entry unless key information is missing.
- The teacher has already chosen the lesson focus.
- Use the assigned lesson immediately.
- Keep VIC's existing teaching style, pacing, interest integration, and one-step-at-a-time behavior.

ASSIGNED LESSON:
Subject: ${assignedLesson.subject || ''}
Title: ${assignedLesson.title || ''}
Lesson: ${assignedLesson.lesson_text || ''}

STUDENT SUPPORT MODE:
${studentMode || ''}

STUDENT INTEREST:
${studentInterest || ''}

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

    return res.status(200).json({ reply })
  } catch (error) {
    console.error('Server error:', error)
    return res.status(500).json({ error: 'Server error' })
  }
}

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
    transcript,
    studentName,
    gradeLevel,
    date,
    sessionFocus,
    studentInterest,
  } = req.body || {}

  if (!Array.isArray(transcript) || transcript.length === 0) {
    return res.status(400).json({ error: 'Missing transcript array' })
  }

  const safeStudentName = typeof studentName === 'string' && studentName.trim()
    ? studentName.trim()
    : 'Student'

  const safeGradeLevel = typeof gradeLevel === 'string' && gradeLevel.trim()
    ? gradeLevel.trim()
    : 'Not specified'

  const safeDate = typeof date === 'string' && date.trim()
    ? date.trim()
    : new Date().toISOString().slice(0, 10)

  const safeSessionFocus = typeof sessionFocus === 'string' && sessionFocus.trim()
    ? sessionFocus.trim()
    : 'General support session'

  const safeStudentInterest = typeof studentInterest === 'string' && studentInterest.trim()
    ? studentInterest.trim()
    : 'Not specified'

  const transcriptText = transcript
    .slice(-20)
    .map((entry) => {
      const role = entry?.role === 'assistant' ? 'VIC' : 'Student'
      const content = typeof entry?.content === 'string' ? entry.content.trim() : ''
      return content ? `${role}: ${content}` : ''
    })
    .filter(Boolean)
    .join('\n')

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: [
          {
            role: 'system',
            content:
              'You are a professional instructional coach writing classroom-quality student session reports. Use evidence from the transcript. Keep language specific and actionable. Return valid JSON only.',
          },
          {
            role: 'user',
            content: `Build a VIC Learning Report JSON object with EXACT keys:
{
  "performanceSummary": "string",
  "skillsDemonstrated": ["string"],
  "areasForGrowth": ["string"],
  "nextInstructionalSteps": ["string"],
  "sessionEvidence": ["string"],
  "parentFriendlySummary": "string"
}

Requirements:
- performanceSummary: 2-4 sentences in professional teacher language.
- each array: 3-6 concise bullets.
- sessionEvidence: include concrete student work/actions from transcript.
- parentFriendlySummary: plain language, 2-3 sentences.
- Do not include markdown fences.

Student Name: ${safeStudentName}
Grade Level: ${safeGradeLevel}
Date: ${safeDate}
Session Focus / Topic: ${safeSessionFocus}
Student Interest Used: ${safeStudentInterest}

Transcript:
${transcriptText}`,
          },
        ],
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || 'OpenAI request failed',
      })
    }

    const outputText =
      data.output_text ||
      data.output?.[0]?.content?.[0]?.text ||
      ''

    const jsonMatch = outputText.match(/\{[\s\S]*\}/)
    const rawJson = jsonMatch ? jsonMatch[0] : outputText
    const parsedReport = JSON.parse(rawJson)

    return res.status(200).json({ report: parsedReport })
  } catch (error) {
    console.error('REPORT API ERROR:', error)
    return res.status(500).json({ error: 'Failed to generate report' })
  }
}

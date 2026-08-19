import { requireApprovedProfile } from '../../lib/server-auth'

export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    transcript,
    studentId,
    classId,
    date,
  } = req.body || {}

  if (!Array.isArray(transcript) || transcript.length === 0) {
    return res.status(400).json({ error: 'Missing transcript array' })
  }

  const auth = await requireApprovedProfile(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })
  if (auth.profile.role !== 'teacher') {
    return res.status(403).json({ error: 'Only approved teachers can generate reports.' })
  }

  const safeStudentId = Number(studentId)
  const safeClassId = Number(classId)
  if (!Number.isInteger(safeStudentId) || !Number.isInteger(safeClassId)) {
    return res.status(400).json({ error: 'Valid studentId and classId values are required.' })
  }

  const { data: classes, error: classError } = await auth.admin
    .from('classes').select('id, class_name, grade_level')
    .eq('id', safeClassId).eq('teacher_id', auth.profile.id).limit(1)
  if (classError) return res.status(500).json({ error: 'Could not verify class ownership.' })
  const verifiedClass = classes?.[0]
  if (!verifiedClass) return res.status(403).json({ error: 'The selected class does not belong to this teacher.' })

  const { data: enrollments, error: enrollmentError } = await auth.admin
    .from('enrollments').select('student_id, users:student_id(id, name, email, interest_tags)')
    .eq('class_id', safeClassId).eq('student_id', safeStudentId).limit(1)
  if (enrollmentError) return res.status(500).json({ error: 'Could not verify student enrollment.' })
  const enrollment = enrollments?.[0]
  const verifiedStudent = Array.isArray(enrollment?.users) ? enrollment.users[0] : enrollment?.users
  if (!verifiedStudent?.id) return res.status(403).json({ error: 'The student is not enrolled in the selected class.' })

  const safeStudentName = verifiedStudent.name || verifiedStudent.email || 'Student'

  const safeGradeLevel = verifiedClass.grade_level == null ? '' : String(verifiedClass.grade_level)

  const safeDate = typeof date === 'string' && date.trim()
    ? date.trim()
    : new Date().toISOString().slice(0, 10)

  const { data: assignments } = await auth.admin
    .from('assignments')
    .select('lesson_id, assigned_at, lessons:lesson_id(title)')
    .eq('student_id', safeStudentId)
    .order('assigned_at', { ascending: false, nullsFirst: false })
    .limit(1)
  const verifiedLesson = Array.isArray(assignments?.[0]?.lessons)
    ? assignments[0].lessons[0]
    : assignments?.[0]?.lessons
  const safeSessionFocus = verifiedLesson?.title || 'General support session'

  const safeStudentInterest = Array.isArray(verifiedStudent.interest_tags)
    ? verifiedStudent.interest_tags.join(', ')
    : ''

  const transcriptText = transcript
    .slice(-20)
    .map((entry) => {
      const role = entry?.role === 'assistant' ? 'VIC' : 'Student'
      const content = typeof entry?.content === 'string' ? entry.content.trim() : ''
      return content ? `${role}: ${content}` : ''
    })
    .filter(Boolean)
    .join('\n')

  const contextLines = [
    `Student Name: ${safeStudentName}`,
    safeGradeLevel ? `Grade Level: ${safeGradeLevel}` : '',
    `Date: ${safeDate}`,
    `Session Focus / Topic: ${safeSessionFocus}`,
    safeStudentInterest ? `Student Interest Used: ${safeStudentInterest}` : '',
  ]
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
  "primaryStrength": "string",
  "primaryAreaForGrowth": "string",
  "skillsDemonstrated": ["string"],
  "areasForGrowth": ["string"],
  "nextInstructionalSteps": ["string"],
  "sessionEvidence": ["string"],
  "parentFriendlySummary": "string"
}

Requirements:
- performanceSummary: 2-4 sentences in professional teacher language.
- primaryStrength: one concise, teacher-meaningful sentence that names the student's top strength from this session.
- primaryAreaForGrowth: one concise, teacher-meaningful sentence naming the highest-leverage next growth target.
- each array: 3-6 concise bullets.
- sessionEvidence: include concrete student work/actions from transcript.
- parentFriendlySummary: plain language, 2-3 sentences.
- Do not include markdown fences.

${contextLines}

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
    const safeSkills = Array.isArray(parsedReport.skillsDemonstrated)
      ? parsedReport.skillsDemonstrated
      : []
    const safeGrowthAreas = Array.isArray(parsedReport.areasForGrowth)
      ? parsedReport.areasForGrowth
      : []

    if (!parsedReport.primaryStrength) {
      parsedReport.primaryStrength = safeSkills[0] || 'Student showed steady progress with guided support.'
    }

    if (!parsedReport.primaryAreaForGrowth) {
      parsedReport.primaryAreaForGrowth =
        safeGrowthAreas[0] || 'Continue building independent accuracy on the target skill.'
    }

    return res.status(200).json({ report: parsedReport })
  } catch (error) {
    console.error('REPORT API ERROR:', error)
    return res.status(500).json({ error: 'Failed to generate report' })
  }
}

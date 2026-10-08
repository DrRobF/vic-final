import { requireApprovedProfile } from '../../lib/server-auth'

export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    studentId,
    classId,
    date,
  } = req.body || {}

  // Never treat a browser-provided assignment description as student work.

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
    .select('lesson_id, assigned_at, lessons:lesson_id!inner(title,class_id)')
    .eq('student_id', safeStudentId)
    .eq('lessons.class_id', safeClassId)
    .order('assigned_at', { ascending: false, nullsFirst: false })
    .limit(1)
  const verifiedLesson = Array.isArray(assignments?.[0]?.lessons)
    ? assignments[0].lessons[0]
    : assignments?.[0]?.lessons
  let safeSessionFocus = verifiedLesson?.title || 'VIC learning conversation'

  const safeStudentInterest = Array.isArray(verifiedStudent.interest_tags)
    ? verifiedStudent.interest_tags.join(', ')
    : ''

  const {data:snapshots,error:activityError}=await auth.admin.from('vic_activity_snapshots').select('assignment_id,turns,updated_at').eq('student_id',safeStudentId).eq('class_id',safeClassId).order('updated_at',{ascending:false}).limit(3)
  if(activityError)return res.status(500).json({error:'Could not read recorded VIC activity.'})
  const {data:openWork,error:openError}=await auth.admin.from('vic_open_work_snapshots').select('turns,updated_at').eq('student_id',safeStudentId).eq('class_id',safeClassId).maybeSingle()
  if(openError)return res.status(500).json({error:'Could not read recorded VIC activity.'})
  const sources=[...(snapshots||[]).map(s=>({...s,label:'Teacher Lesson'})),...(openWork?[{...openWork,label:'My Own Work'}]:[])].sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at)).slice(0,3)
  if(sources[0]?.label==='My Own Work')safeSessionFocus='My Own Work with VIC'
  else if(sources[0]?.assignment_id){const {data:assignment}=await auth.admin.from('assignments').select('lessons:lesson_id(title)').eq('id',sources[0].assignment_id).eq('student_id',safeStudentId).maybeSingle();const linked=Array.isArray(assignment?.lessons)?assignment.lessons[0]:assignment?.lessons;if(linked?.title)safeSessionFocus=linked.title}
  const transcriptText=sources.reverse().flatMap(row=>(Array.isArray(row.turns)?row.turns:[]).map(turn=>`Mode: ${row.label}\nStudent: ${String(turn.student||'').slice(0,1200)}\nVIC: ${String(turn.vic||'').slice(0,1800)}`)).slice(-20).join('\n\n')
  if(!transcriptText.trim())return res.status(409).json({error:'No recorded VIC conversation is available for this student in this class yet. An assigned lesson alone is not a learning report.'})

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
              'You are a professional instructional coach writing classroom-quality student session reports. Use only observed evidence from the recorded conversation. Distinguish a student response from VIC prompting. If evidence is thin, say so; never infer mastery, behavior, or progress from an assignment alone. Return valid JSON only.',
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
      parsedReport.primaryStrength = safeSkills[0] || 'The recorded exchange does not establish a specific strength yet.'
    }

    if (!parsedReport.primaryAreaForGrowth) {
      parsedReport.primaryAreaForGrowth =
        safeGrowthAreas[0] || 'More student responses are needed to identify a specific growth target.'
    }

    const {error:saveError}=await auth.admin.from('vic_learning_reports').upsert({teacher_auth_id:auth.user.id,class_id:safeClassId,student_id:safeStudentId,report:parsedReport,generated_at:new Date().toISOString()},{onConflict:'teacher_auth_id,class_id,student_id'})
    if(saveError)throw saveError
    return res.status(200).json({ report: parsedReport, sessionFocus: safeSessionFocus })
  } catch (error) {
    console.error('REPORT API ERROR:', error)
    return res.status(500).json({ error: 'Failed to generate report' })
  }
}

export const STUDENT_DIRECTED = 'student_directed'
export const TEACHER_DIRECTED = 'teacher_directed'

export function normalizeSessionMode(value) {
  return value === TEACHER_DIRECTED ? TEACHER_DIRECTED : STUDENT_DIRECTED
}

export function normalizeSupportLevel(value) {
  if (typeof value !== 'string') return ''
  const normalized = value.trim().toLowerCase()
  if (normalized === 'on-level' || normalized === 'on_level') return 'core'
  return ['remediation', 'core', 'enrichment'].includes(normalized) ? normalized : ''
}

export function selectActiveEnrollment(enrollments, activeClassId) {
  const classId = Number(activeClassId)
  if (!Number.isInteger(classId)) return null
  return (enrollments || []).find((row) => Number(row.class_id) === classId) || null
}

export function selectActiveAssignment(assignments, enrollment) {
  if (!enrollment) return null
  const supportLevel = normalizeSupportLevel(enrollment.support_level)
  const classId = Number(enrollment.class_id)
  return (assignments || []).find((assignment) => {
    const status = String(assignment?.status || 'assigned').toLowerCase()
    const lesson = Array.isArray(assignment?.lessons) ? assignment.lessons[0] : assignment?.lessons
    return status === 'assigned' && Number(lesson?.class_id) === classId && (!supportLevel || normalizeSupportLevel(assignment.mode) === supportLevel)
  }) || null
}

export function buildVicContext({ mode, lesson, assignmentMode, supportLevel, interest, gradeLevel }) {
  const resolvedMode = normalizeSessionMode(mode)
  const safeInterest = typeof interest === 'string' ? interest.trim().slice(0, 120) : ''

  if (resolvedMode === STUDENT_DIRECTED) {
    return [
      'MY OWN WORK:',
      '- Follow the topic or task the student chooses. Homework help, a new lesson, and skill practice are all allowed.',
      '- Use only this mode’s conversation; do not import an objective from any other mode or source.',
      '- If no saved interest is provided, briefly ask what the student is interested in when it would help personalize learning.',
      safeInterest ? `- CURRENT saved student interest (optional personalization only): ${safeInterest}. Use this value from now on; any older interest mentioned in conversation history is stale and must not override it.` : '',
    ].filter(Boolean).join('\n')
  }

  const title = typeof lesson?.title === 'string' ? lesson.title.trim() : ''
  const lessonText = typeof lesson?.lesson_text === 'string' ? lesson.lesson_text.trim() : ''
  if (!title || !lessonText || lesson?.is_active === false) return null

  return [
    'TEACHER LESSON (TRUSTED SERVER CONTEXT):',
    `- Assigned objective: ${title}`,
    `- Subject: ${typeof lesson.subject === 'string' ? lesson.subject.trim() : ''}`,
    `- Lesson text: ${lessonText}`,
    `- Assignment mode: ${assignmentMode || ''}`,
    `- Support level: ${normalizeSupportLevel(supportLevel || assignmentMode) || 'core'}`,
    `- Grade: ${gradeLevel == null ? '' : String(gradeLevel)}`,
    '- Keep every instructional response anchored to the assigned objective. Never silently change academic topics.',
    `- If the student requests another topic, respond warmly, say it can be covered another time, and redirect to ${title}.`,
    '- Ask for an interest only if none is saved. Interests may personalize examples, analogies, vocabulary, or practice, but never replace the objective.',
    safeInterest ? `- CURRENT saved student interest (personalization only): ${safeInterest}. Use this value from now on; any older interest in conversation history is stale and must not override it.` : '',
  ].filter(Boolean).join('\n')
}

export function messagesForModeSwitch(mode, lessonTitle = '') {
  if (normalizeSessionMode(mode) === TEACHER_DIRECTED) {
    return [{ role: 'assistant', text: `Teacher Lesson: ${lessonTitle}. Send a message when you’re ready to begin.` }]
  }
  return [{
    role: 'assistant',
    text: 'My Own Work is ready. Choose a topic, ask for homework help, start a lesson, or practice a skill.',
  }]
}

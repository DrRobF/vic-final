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

  // A practice skill VIC chose from the grade's standards (the practice path), not a teacher lesson.
  if (lesson?.practice_standard) {
    return [
      'PRACTICE SKILL (TRUSTED SERVER CONTEXT):',
      `- Skill: ${title}`,
      `- Standard: ${lessonText}`,
      `- Support level: ${normalizeSupportLevel(assignmentMode || supportLevel) || 'core'}`,
      `- Grade: ${gradeLevel == null ? '' : String(gradeLevel)}`,
      '- This is practice time in a room where no teacher is at the student’s side. Teach the skill in one or two short steps with an example, then practice it with the student: ONE short problem at a time, matched to the support level, with feedback after each answer.',
      '- For reading skills, write a short passage (4–8 sentences for grade 3, longer for grades 4–5) at the right level, then ask one question about it at a time.',
      '- Make it feel like a game: notice effort, keep a friendly streak count, vary the problems. Use the student’s interest for the examples when one is saved.',
      '- If the student is stuck, re-teach the idea a different way, then try an easier problem before going back up.',
      '- Stay on this skill. If the student asks for another topic, say it can come later and bring them back.',
      '- When you are sure how they did, add the GOAL CHECK tag and tell them warmly that a new skill is ready.',
      safeInterest ? `- CURRENT saved student interest (personalization only): ${safeInterest}.` : '',
    ].filter(Boolean).join('\n')
  }

  return [
    'TEACHER LESSON (TRUSTED SERVER CONTEXT):',
    '- assignedLesson is present: this is the lesson the teacher assigned. Follow the ASSIGNED LESSON ENTRY rules, not the full lesson-entry sequence.',
    `- Assigned objective: ${title}`,
    `- Subject: ${typeof lesson.subject === 'string' ? lesson.subject.trim() : ''}`,
    `- Lesson text: ${lessonText}`,
    `- Assignment mode: ${assignmentMode || ''}`,
    `- Support level: ${normalizeSupportLevel(assignmentMode || supportLevel) || 'core'}`,
    `- Grade: ${gradeLevel == null ? '' : String(gradeLevel)}`,
    '- Adapt each response to the assignment mode: remediation uses smaller steps, explicit modeling and frequent checks; core uses grade-appropriate explanation and practice; enrichment uses deeper reasoning and extension while preserving the same standard and objective.',
    '- The assignment mode chosen by the teacher governs this lesson; do not use a stale enrollment level to override it.',
    '- You are the student’s co-teacher. Teach this objective; do not quiz or drill. The class teacher teaches it too, so come at it from a different angle: a story, an analogy, a picture in words, a real-life example, or a hands-on idea.',
    '- Teach in small steps: explain one idea, show an example, then invite the student to try that one step with you. Use a quick check only to decide what to teach next, never a string of practice questions.',
    '- When the student is stuck, re-teach the idea a new way instead of asking the same kind of question again.',
    '- Keep every instructional response anchored to the assigned objective. Never silently change academic topics.',
    `- If the student requests another topic, respond warmly, say it can be covered another time, and redirect to ${title}.`,
    '- Ask for an interest only if none is saved. Interests may personalize examples, analogies, vocabulary, or practice, but never replace the objective.',
    safeInterest ? `- CURRENT saved student interest (personalization only): ${safeInterest}. Use this value from now on; any older interest in conversation history is stale and must not override it.` : '',
  ].filter(Boolean).join('\n')
}

export function messagesForModeSwitch(mode, lessonTitle = '') {
  if (normalizeSessionMode(mode) === TEACHER_DIRECTED) {
    return [{ role: 'assistant', text: `Your teacher’s lesson: ${lessonTitle}. Send a message when you’re ready to begin.` }]
  }
  return [{
    role: 'assistant',
    text: 'My Own Work is ready. Choose a topic, ask for homework help, start a lesson, or practice a skill.',
  }]
}

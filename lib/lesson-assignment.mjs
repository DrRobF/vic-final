const ASSIGNMENT_MODES = new Set(['remediation', 'on-level', 'on_level', 'enrichment'])

export function normalizePositiveId(value) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

export function validateAssignedStudents(studentIds, enrolledStudentIds) {
  const requested = [...new Set((studentIds || []).map(normalizePositiveId))]
  if (!requested.length || requested.includes(null)) return { error: 'Choose at least one valid student.' }
  const enrolled = new Set((enrolledStudentIds || []).map(Number))
  if (requested.some((id) => !enrolled.has(id))) {
    return { error: 'Every assigned student must be enrolled in the selected class.' }
  }
  return { studentIds: requested }
}

export function buildAssignmentRows(lessonId, selections, assignedAt) {
  return selections.map(({ studentId, mode }) => ({
    lesson_id: lessonId,
    student_id: studentId,
    mode: ASSIGNMENT_MODES.has(mode) ? (mode === 'on_level' ? 'on-level' : mode) : 'on-level',
    status: 'assigned',
    assigned_at: assignedAt,
  }))
}

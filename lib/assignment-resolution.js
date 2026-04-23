function toEpochMillis(value) {
  if (!value) return Number.NEGATIVE_INFINITY
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed
}

function toNumericId(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY
}

export function compareAssignmentsDesc(a, b) {
  const assignedDelta = toEpochMillis(b?.assigned_at) - toEpochMillis(a?.assigned_at)
  if (assignedDelta !== 0) return assignedDelta

  return toNumericId(b?.id) - toNumericId(a?.id)
}

export function pickLatestAssignment(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null

  return [...rows].sort(compareAssignmentsDesc)[0] || null
}

export function lessonFromAssignment(assignment) {
  if (!assignment) return null
  if (Array.isArray(assignment.lessons)) return assignment.lessons[0] || null
  return assignment.lessons || null
}

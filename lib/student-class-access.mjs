export function normalizeStudentId(value) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

export function canAccessStudentRecord(profile, requestedStudentId) {
  const profileId = normalizeStudentId(profile?.id)
  const requestedId = normalizeStudentId(requestedStudentId)
  return profile?.role === 'student' && profileId !== null && profileId === requestedId
}

export function mapStudentEnrollments(rows) {
  if (!Array.isArray(rows)) return []

  return rows.flatMap((row) => {
    const classRow = Array.isArray(row?.classes) ? row.classes[0] : row?.classes
    const id = normalizeStudentId(row?.class_id)
    if (!id || !classRow || normalizeStudentId(classRow.id) !== id) return []

    return [{
      id,
      className: typeof classRow.class_name === 'string' ? classRow.class_name : '',
      classCode: typeof classRow.class_code === 'string' ? classRow.class_code : '',
      gradeLevel: classRow.grade_level == null ? '' : String(classRow.grade_level),
      supportLevel: typeof row.support_level === 'string' ? row.support_level : '',
    }]
  })
}

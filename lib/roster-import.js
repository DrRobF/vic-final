export const ADMIN_EMAIL = 'drrobfurman@gmail.com'
export const STUDENT_EMAIL_DOMAIN = 'students.askvic.ai'
export const REQUIRED_ROSTER_FIELDS = [
  'First Name', 'Last Name', 'Student ID', 'Grade', 'VIC Username', 'Temporary Password',
]

export const CLASS_CODES_BY_GRADE = {
  K: ['KGM26', 'KGE26'],
  '1': ['G1M26', 'G1E26'],
  '2': ['G2M26', 'G2E26'],
  '3': ['G3M26', 'G3E26'],
  '4': ['G4M26', 'G4E26'],
  '5': ['G5M26', 'G5E26'],
  '6': ['G6M26', 'G6E26'],
}

export function normalizeGrade(value) {
  const grade = String(value || '').trim().toLowerCase()
  if (['k', 'kg', 'kindergarten', '0'].includes(grade)) return 'K'
  const match = grade.match(/^(?:grade\s*)?([1-6])(?:st|nd|rd|th)?$/)
  return match?.[1] || null
}

export function normalizeUsername(value) {
  const username = String(value || '').trim().toLowerCase()
  if (!username || username.includes('@') || !/^[a-z0-9][a-z0-9._-]*$/.test(username)) return null
  return username
}

export function cleanName(firstName, lastName) {
  return [firstName, lastName]
    .map((part) => String(part || '').trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .join(' ')
}

export function validateRosterRows(rows) {
  if (!Array.isArray(rows)) return { rows: [], error: 'The roster payload must be an array.' }
  if (rows.length > 1000) return { rows: [], error: 'A roster may contain at most 1,000 students.' }

  const usernames = new Set()
  return {
    rows: rows.map((source, index) => {
      const rowNumber = index + 2
      const username = normalizeUsername(source?.['VIC Username'])
      const grade = normalizeGrade(source?.['Grade'])
      const name = cleanName(source?.['First Name'], source?.['Last Name'])
      const password = typeof source?.['Temporary Password'] === 'string' ? source['Temporary Password'] : ''
      const errors = []
      if (!name) errors.push('First Name and/or Last Name is required.')
      if (!username) errors.push('VIC Username must contain only letters, numbers, periods, underscores, or hyphens and cannot contain @.')
      if (!password) errors.push('Temporary Password is required.')
      if (!grade) errors.push('Grade must be Kindergarten or grade 1 through 6.')
      if (username && usernames.has(username)) errors.push('VIC Username is duplicated in this CSV.')
      if (username) usernames.add(username)
      return {
        rowNumber,
        name,
        username,
        email: username ? `${username}@${STUDENT_EMAIL_DOMAIN}` : '',
        grade,
        classCodes: grade ? CLASS_CODES_BY_GRADE[grade] : [],
        valid: errors.length === 0,
        errors,
        password,
      }
    }),
  }
}

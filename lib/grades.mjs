// Sorting children by grade, not by first name.
//
// A thousand students in one alphabetical list is unusable: nobody looks for "every
// student called A". They look for "Grade 3". Grade is not stored anywhere, so it is read
// off the class names the school already uses -- "Grade 3 Math", "Kindergarten Reading
// ELA", "VPK Math" -- and anything that does not say a grade is grouped at the end
// rather than guessed at.

const ORDER = { VPK: -2, 'Pre-K': -1, Kindergarten: 0 }

export function gradeOfClass(className) {
 const s = String(className || '').trim()
 if (!s) return null
 const n = s.match(/\bgrade\s*(\d{1,2})\b/i) || s.match(/^(\d{1,2})(?:st|nd|rd|th)\s+grade\b/i)
 if (n) { const g = Number(n[1]); if (g >= 1 && g <= 12) return `Grade ${g}` }
 if (/\bkindergarten\b|\bkinder\b|\bKG\b/i.test(s)) return 'Kindergarten'
 if (/\bVPK\b/i.test(s)) return 'VPK'
 if (/\bpre-?k\b/i.test(s)) return 'Pre-K'
 return null
}

// One grade for a student, from whichever of their classes names one.
export function gradeOfStudent(classes) {
 for (const c of classes || []) { const g = gradeOfClass(c.name); if (g) return g }
 return null
}

export const NO_GRADE = 'Grade not set'
export const NO_CLASS = 'Not in a class yet'

// VPK, Pre-K, Kindergarten, 1..12, then the two catch-alls last.
export function sortGrades(labels) {
 const rank = label => {
  if (label === NO_CLASS) return 1002
  if (label === NO_GRADE) return 1001
  if (label in ORDER) return ORDER[label]
  const m = label.match(/^Grade (\d{1,2})$/)
  return m ? Number(m[1]) : 1000
 }
 return [...labels].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
}

// Students grouped into the buckets a principal actually thinks in.
export function groupByGrade(students) {
 const buckets = new Map()
 for (const s of students) {
  const label = !s.classes?.length ? NO_CLASS : (gradeOfStudent(s.classes) || NO_GRADE)
  if (!buckets.has(label)) buckets.set(label, [])
  buckets.get(label).push(s)
 }
 return sortGrades([...buckets.keys()]).map(grade => ({
  grade,
  students: buckets.get(grade).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
 }))
}

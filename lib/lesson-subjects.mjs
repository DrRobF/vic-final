// One place that knows which subjects the Lesson Designer offers and which of them
// have official standards behind them. Student-facing VIC (practice, room, learner
// levels) deliberately does NOT read this -- it stays reading + math by its own
// whitelist, so adding a subject here never pushes new content at a child.
import coverage from '../data/standard-coverage.mjs'

export const SUBJECT_LABELS = { math: 'Math', reading: 'Reading / ELA', science: 'Science', socialstudies: 'Social Studies' }
export const PLANNER_SUBJECTS = Object.keys(SUBJECT_LABELS)

export function subjectLabel(subject) { return SUBJECT_LABELS[subject] || String(subject || '') }

// Grades of this state/subject that the official catalogue covers.
export function cataloguedGrades(state, subject) { return coverage[state]?.[subject] || [] }

// True when the teacher can pick from official standards rather than pasting one.
export function hasCatalogue(state, grade, subject) { return cataloguedGrades(state, subject).includes(grade) }

// Subjects the planner lists for a state, each flagged with whether it is catalogued.
export function subjectOptions(state) {
 return PLANNER_SUBJECTS.map(subject => {
  const catalogued = cataloguedGrades(state, subject).length > 0
  return { value: subject, label: catalogued ? SUBJECT_LABELS[subject] : `${SUBJECT_LABELS[subject]} — paste a standard`, catalogued }
 })
}

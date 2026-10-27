// The denominator. Until now VIC recorded a verdict (vic_goal_results) only when it was sure
// enough to say met/partly/not_yet. So the evidence had a numerator and no denominator: a child
// who worked eight standards and earned three 'met' rows looked exactly like a child who worked
// three and met all three. Worse, the child who tried hardest and never got there left no trace
// at all -- the silence read as "nothing happened" instead of "this is not working".
//
// So every time a child works a lesson or a practice skill with VIC, an attempt row is opened
// (vic_goal_attempts, one per assignment) and kept up to date. The verdict, when it comes,
// resolves that attempt. An attempt still open after several sessions is the signal the red-flag
// rule will be built on -- repeated unresolved attempts at one standard.
//
// The row also carries the support condition it was earned under, because a 'met' with the
// passage read aloud is not the same fact as a 'met' earned cold, and a report that cannot tell
// them apart will quietly overstate what a child can do.
import { attemptSupport } from './learner-profile.mjs'

const grade = n => (Number.isInteger(n) && n >= 0 && n <= 12 ? n : null)
const id = n => (Number.isInteger(Number(n)) && Number(n) > 0 ? Number(n) : null)

/**
 * The support condition to stamp on this attempt.
 * `spoke` is what actually happened -- the runtime reporting that VIC spoke -- not what the
 * child was allowed to do. A child can have the speaker button all period and never press it.
 */
export function conditionFor({ support, spoke = false, alternateStandard = false } = {}) {
 return {
  ...attemptSupport(support, { spokeScaffold: spoke, spokeAssessed: spoke }),
  alternate_standard: Boolean(alternateStandard),
 }
}

/**
 * The row to upsert on vic_goal_attempts, on conflict of assignment_id.
 *
 * Two columns are left out unless they are true, and one is left out always:
 * `audio_used` and `audio_on_assessed` because they must only ever go from false to true --
 * a later turn where nothing was spoken must not erase the fact that something was spoken
 * earlier in the same attempt. `started_at` because the database sets it on insert, and
 * sending it again on every turn would keep moving the moment the child began.
 */
export function attemptRow({ studentId, classId, lessonId, assignmentId, standardId = null, condition = {}, level = null, enrolledGrade = null, turns = 0 } = {}) {
 const assignment = id(assignmentId)
 if (!id(studentId) || !assignment) return null
 return {
  student_id: id(studentId),
  class_id: id(classId),
  lesson_id: id(lessonId),
  assignment_id: assignment,
  standard_id: standardId || null,
  last_seen_at: new Date().toISOString(),
  turns: Number.isInteger(turns) && turns > 0 ? turns : 0,
  audio_policy: condition.audio_policy || null,
  ...(condition.audio_used ? { audio_used: true } : {}),
  ...(condition.audio_on_assessed ? { audio_on_assessed: true } : {}),
  language: condition.language || 'en',
  alternate_standard: Boolean(condition.alternate_standard),
  instructional_level: grade(level),
  enrolled_grade: grade(enrolledGrade),
 }
}

// Closing an attempt: the verdict arrived, so it is no longer open. Verdicts are given once,
// so an attempt already resolved is left alone rather than re-dated.
export function resolvePatch(verdict) {
 if (!['met', 'partly', 'not_yet'].includes(verdict)) return null
 return { verdict, resolved_at: new Date().toISOString() }
}

/**
 * The verdict row. Everything that reads student evidence today reads vic_goal_results, so the
 * three facts that change what a verdict MEANS are carried on the verdict itself rather than
 * making every one of those queries learn a join before it can be honest.
 */
export function resultRow({ studentId, classId, lessonId, assignmentId, standardId = null, verdict, practice = false, attemptId = null, condition = {} } = {}) {
 if (!['met', 'partly', 'not_yet'].includes(verdict)) return null
 return {
  student_id: id(studentId),
  class_id: id(classId),
  lesson_id: id(lessonId),
  assignment_id: id(assignmentId),
  standard_id: standardId || null,
  verdict,
  practice: Boolean(practice),
  attempt_id: id(attemptId),
  audio_on_assessed: Boolean(condition.audio_on_assessed),
  language: condition.language || 'en',
  alternate_standard: Boolean(condition.alternate_standard),
 }
}

// Which student_levels subject a lesson belongs to. The levels table keeps one level per
// subject, and 'reading' covers the lessons where reading is what stands in the way.
export const levelSubjectFor = subjectName => (/math/i.test(String(subjectName || '')) ? 'math' : 'reading')

// How many turns the child has taken. The page posts the whole conversation each time, so
// counting the child's own messages is the turn count without another query.
export const turnsIn = messages => (Array.isArray(messages) ? messages.filter(m => m?.role === 'user').length : 0)

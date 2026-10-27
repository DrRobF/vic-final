// Teaching the child in front of you, rather than the grade on the roster.
//
// Two separate questions, deliberately kept apart:
//
//   WHAT do we teach this child?   -> instructional level (student_levels), which may sit
//                                     above or below the enrolled grade.
//   WHAT HELP do they get doing it? -> their support profile (student_supports), gated per
//                                     standard by what that standard actually measures.
//
// The second one is the subtle half. Reading a math word problem aloud removes a barrier that
// is not the point. Reading a comprehension passage aloud removes the point itself. So
// read-aloud is not a per-child switch -- it is a per-child switch GATED BY THE STANDARD, and
// the gate only ever closes on the assessed content. Directions, question stems, answer
// choices and VIC's own explanation are scaffolding and are always available, in every
// language, under every policy. A child who cannot decode the instructions fails for a reason
// that has nothing to do with the standard.

// Catalogue grades are strings with K for kindergarten; levels are numbers with 0 for K.
export const toLevel = grade => (grade == null || grade === '' ? null : String(grade).toUpperCase() === 'K' ? 0 : Number(grade))
export const toGrade = level => (level == null ? null : Number(level) === 0 ? 'K' : String(level))

export const DEFAULT_SUPPORTS = { read_aloud: 'off', language: 'en', alternate_standards: false }

// What a teacher sees, so the words on the screen match the words in this file.
export const READ_ALOUD_LABELS = {
 off: 'No read-aloud',
 on_request: 'Speaker buttons — the child taps to hear it',
 always: 'VIC reads everything aloud',
}
export const LANGUAGE_LABELS = { en: 'English', es: 'Spanish', ht: 'Haitian Creole' }

// Why a piece of text may or may not be spoken. Teacher-facing: this is what shows in the
// tooltip where the speaker button would otherwise be, so the absence is explained rather
// than looking broken.
const WHY = {
 free: 'Reading isn’t what this skill measures, so anything here can be read aloud.',
 stem_only: 'The question can be read aloud. The passage can’t — reading it is the skill.',
 none: 'This skill is reading the words, so nothing in the task can be read aloud. Directions still can.',
 required: 'This skill is listening, so it has to be heard.',
}

/**
 * What support applies to one standard for one child.
 * Returns permissions, not actions -- what the runtime is ALLOWED to do. What it actually
 * did is recorded separately on the attempt row, because a 'met' earned with the passage
 * read aloud is a different fact from one earned cold.
 */
export function supportFor(standard, supports = DEFAULT_SUPPORTS) {
 const s = { ...DEFAULT_SUPPORTS, ...(supports || {}) }
 const audio = standard?.audio || 'stem_only'
 const translate = standard?.translate || 'scaffold_only'
 const wants = s.read_aloud !== 'off'
 const required = audio === 'required'

 return {
  // Directions, stems, choices, VIC's own words. Always speakable when the child wants it --
  // and when the standard is a listening standard, speakable whether they asked or not.
  speakScaffold: wants || required,
  // The passage, the item, the thing being judged.
  speakAssessed: required || (wants && audio === 'free'),
  // VIC must speak this one; there may be no text at all. Overrides read_aloud: 'off',
  // because a listening standard assessed in silence measures nothing.
  mustSpeak: required,
  // Speak without being asked, rather than waiting for a tap.
  autoSpeak: required || s.read_aloud === 'always',

  translateScaffold: s.language !== 'en',
  // English text under study is never translated. Translating it measures nothing.
  translateAssessed: s.language !== 'en' && translate === 'free',

  language: s.language,
  audioPolicy: audio,
  why: WHY[audio] || WHY.stem_only,
 }
}

/**
 * Which grade's standards to teach, per subject.
 * Falls back to the enrolled grade when nobody has set a level, so this is safe to call
 * before any of the placement work exists.
 */
export function levelFor(levels, subject, enrolledGrade) {
 const row = (levels || []).find(l => l.subject === subject)
 const enrolled = toLevel(enrolledGrade)
 if (!row || row.level == null) return { level: enrolled, source: 'enrolled', confirmed: true, offset: 0 }
 return {
  level: row.level,
  source: row.source || 'teacher',
  // A level VIC proposed from a probe that no adult has looked at yet. VIC may teach to it;
  // no report may describe a child by it.
  confirmed: Boolean(row.confirmed_at),
  offset: enrolled == null ? 0 : row.level - enrolled,
 }
}

/**
 * How a teacher should see a level. Never shown to the student: a 6th grader working on 1st
 * grade skills does not need her screen to say "Grade 1" where the room can read it. Student
 * screens label by skill name only.
 */
export function levelSummary(level, enrolledGrade) {
 const enrolled = toLevel(enrolledGrade)
 if (level == null) return 'No level set'
 const name = level === 0 ? 'Kindergarten' : `Grade ${level}`
 if (enrolled == null || level === enrolled) return name
 const years = Math.abs(level - enrolled)
 const unit = years === 1 ? 'year' : 'years'
 return `${name} — ${years} ${unit} ${level > enrolled ? 'ahead of' : 'below'} enrolled grade`
}

/**
 * Which catalogue a child's standards come from.
 *
 * Alternate standards (Florida Access Points) are for students with significant cognitive
 * disabilities, on the authority of an IEP team. They are NOT imported yet -- the catalogue
 * rule is that standards come from the official documents and are never written by VIC, so
 * until the CPALMS documents are imported this returns `available: false` and the caller must
 * stop. Quietly serving general-catalogue standards to a child whose IEP says otherwise is
 * the failure this guards against: it looks like it is working.
 */
export function trackFor(supports = DEFAULT_SUPPORTS, catalogue = []) {
 const s = { ...DEFAULT_SUPPORTS, ...(supports || {}) }
 if (!s.alternate_standards) return { track: 'general', available: true }
 const hasAccess = catalogue.some(std => std.track === 'access')
 return {
  track: 'access',
  available: hasAccess,
  reason: hasAccess ? '' : 'Access Points aren’t loaded yet, so there are no alternate standards to teach from.',
 }
}

/**
 * The support condition to stamp on an attempt row, from the permissions and what happened.
 * `spokeAssessed` is a fact the runtime reports, not a permission -- the child may have had
 * the speaker button and never pressed it.
 */
export function attemptSupport(support, { spokeScaffold = false, spokeAssessed = false } = {}) {
 return {
  audio_policy: support.audioPolicy,
  audio_used: Boolean(spokeScaffold || spokeAssessed),
  // Only this one changes what the verdict means.
  audio_on_assessed: Boolean(spokeAssessed && support.speakAssessed),
  language: support.language,
 }
}

/**
 * The standards to teach this child, from the right catalogue.
 *
 * `general` and `access` are the two catalogues (data/lesson-standards.json and
 * data/access-points.json). They are kept in separate files on purpose: every existing query
 * filters the general catalogue by state + subject + grade, so an Access Point living in that
 * file would be served to any child whose grade matched, silently, and the screen would look
 * fine. Passing the wrong list here is a visible mistake; mixing the files was an invisible one.
 *
 * Returns `available: false` rather than falling back. A child whose IEP says Access Points
 * must not quietly receive grade-level standards because the alternate ones were missing.
 */
export function standardsFor({ supports = DEFAULT_SUPPORTS, general = [], access = [], subject, level, state = 'FL' }) {
 const chosen = trackFor(supports, access)
 if (!chosen.available) return { ...chosen, standards: [] }
 const grade = toGrade(level)
 const pool = chosen.track === 'access' ? access : general
 const standards = pool.filter(s =>
  s.state === state && s.subject === subject && s.grade === grade &&
  (chosen.track === 'access' ? s.track === 'access' : s.track !== 'access'))
 return { ...chosen, standards }
}

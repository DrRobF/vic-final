// Who may change what about how VIC teaches one child, and what a change has to look like.
//
// The rules, and why:
//
//  * A school leader may change everything, for any student.
//  * A teacher may change the working level of a student enrolled in one of THEIR classes.
//  * Only a school leader may turn alternate standards (Florida Access Points) on or off.
//    They are assigned by an IEP team and must never be inferred from low scores -- that is how
//    a struggling reader gets moved onto an alternate diploma track by accident. AskVic has no
//    special-education role yet, so until it does the safe door is the leader, who acts on what
//    the IEP team decided. A teacher can SEE the setting and is told who to ask.
//  * Nobody else touches any of it.
//
// Read-aloud and language are stored by the data model but are not offered here: nothing in VIC
// acts on them yet, and a switch that does nothing is worse than no switch. They are accepted
// by the validator so the screen can add them the day they work, with the same permissions.

export const SUBJECTS = ['reading', 'math']
export const READ_ALOUD = ['off', 'on_request', 'always']
export const LANGUAGES = ['en', 'es', 'ht']

/**
 * What this person may do for this student.
 * `teaches` means the student is enrolled in a class the person is the teacher of.
 */
export function permissionsFor({ leader = false, teaches = false } = {}) {
 return {
  level: leader || teaches,
  readAloud: leader || teaches,
  language: leader || teaches,
  alternateStandards: leader,
 }
}

const isLevel = v => Number.isInteger(v) && v >= 0 && v <= 12

/**
 * Check a request body. Returns { ok, errors, levels, supports } where `levels` holds only the
 * subjects the caller mentioned (null clears one, back to the enrolled grade) and `supports`
 * holds only the fields they mentioned. Anything not mentioned is left alone, so changing one
 * thing never silently resets another.
 */
export function parseSettings(body = {}) {
 const errors = []
 const levels = {}
 const supports = {}

 if (body.levels != null) {
  if (typeof body.levels !== 'object' || Array.isArray(body.levels)) errors.push('levels must be an object.')
  else for (const [subject, raw] of Object.entries(body.levels)) {
   if (!SUBJECTS.includes(subject)) { errors.push(`Unknown subject: ${subject}.`); continue }
   if (raw === null) { levels[subject] = null; continue }
   const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw
   if (!isLevel(n)) errors.push(`${subject} level must be a whole number from 0 (kindergarten) to 12.`)
   else levels[subject] = n
  }
 }

 if (body.supports != null) {
  const s = body.supports
  if (typeof s !== 'object' || Array.isArray(s)) errors.push('supports must be an object.')
  else {
   if ('read_aloud' in s) READ_ALOUD.includes(s.read_aloud) ? (supports.read_aloud = s.read_aloud) : errors.push('read_aloud must be off, on_request or always.')
   if ('language' in s) LANGUAGES.includes(s.language) ? (supports.language = s.language) : errors.push('language must be en, es or ht.')
   if ('alternate_standards' in s) typeof s.alternate_standards === 'boolean' ? (supports.alternate_standards = s.alternate_standards) : errors.push('alternate_standards must be true or false.')
  }
 }

 if (!Object.keys(levels).length && !Object.keys(supports).length && !errors.length) errors.push('Nothing to change.')
 return { ok: !errors.length, errors, levels, supports }
}

/**
 * Which of the requested changes this person is not allowed to make.
 * A request to set a field to the value it already has is not a change and is never refused --
 * a teacher saving the whole form must not be blocked by a field they did not touch.
 */
export function refusedChanges(parsed, perms, current = {}) {
 const refused = []
 if (Object.keys(parsed.levels).length && !perms.level) refused.push('the working level')
 const s = parsed.supports
 if ('read_aloud' in s && !perms.readAloud && s.read_aloud !== (current.read_aloud ?? 'off')) refused.push('read-aloud')
 if ('language' in s && !perms.language && s.language !== (current.language ?? 'en')) refused.push('language')
 if ('alternate_standards' in s && !perms.alternateStandards && s.alternate_standards !== Boolean(current.alternate_standards)) refused.push('alternate standards')
 return refused
}

/** How a teacher is told who to ask, in words that name a person rather than a permission. */
export const ALTERNATE_STANDARDS_HELP = 'Alternate standards are set by your school leader, from the student’s IEP.'

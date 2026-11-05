// What the attempt rows actually say about children, and the one distinction that decides
// whether a number is worth showing anybody.
//
// The Oct 27 plan was to flag a child on unresolved attempts: we tried, it did not land.
// Against the first week of real rows that rule does not survive. Of 109 attempts, 45 have
// three turns or fewer and 42 of those are still open -- which is 41% of everything recorded.
// Those are not children who struggled. That is a child opening a skill and leaving: a bell,
// a login, a switch to another skill, an aide relaunching the room. Build the flag on
// "unresolved" and five sixths of it is children who never started, and the children who
// worked hard and got nowhere are buried underneath them.
//
// So turns is the filter, and it splits one flag into two facts with two different owners.
// A child who opens five skills and leaves is a supervision question -- the adult in the
// room. A child who works fifteen turns three times and still cannot do it is a teaching
// question -- the teacher, or intervention. Put both on one list called "red flag" and the
// principal is sent to the wrong person half the time, which is worse than no list.
//
// Deliberately absent from this file: the words "on level". `met` is acquisition -- VIC
// judged three correct, unaided, in one sitting -- and nobody knows whether it survived a
// fortnight. The honest version needs the second reading agreed in
// assessment-and-privacy-spec.md: met, then met again two or more weeks later. Until that
// exists this file reports what was attempted and what landed, and never grades a child.

// Three or fewer turns is not a lesson, it is a door opening. Ten or more is a child who
// stayed and worked. The 4-9 band in between is real but ambiguous, and is deliberately
// counted toward neither signal -- a flag that fires on ambiguous evidence trains people to
// ignore flags.
export const BROWSE_TURNS = 3
export const WORK_TURNS = 10

// How many low-effort attempts before a child's engagement is a pattern rather than a
// Tuesday. Three, because two is a bad morning and everybody has those.
export const BROWSE_FLAG = 3

// Default reporting window. Two weeks is long enough that one absence does not create a
// flag and short enough that what it says is still true.
export const WINDOW_DAYS = 14

const num = n => (Number.isFinite(Number(n)) ? Number(n) : 0)

/** What the child did in this attempt, judged on turns alone. */
export function effortOf(attempt) {
 const t = num(attempt?.turns)
 if (t <= BROWSE_TURNS) return 'browsed'
 return t >= WORK_TURNS ? 'worked' : 'some'
}

/** Attempts inside the window, newest first. A null or unparseable date is excluded rather
 * than assumed recent -- an undated row must not be able to raise a flag. */
export function withinWindow(attempts, { days = WINDOW_DAYS, now = Date.now() } = {}) {
 const floor = now - days * 86400000
 return (Array.isArray(attempts) ? attempts : [])
  .filter(a => { const t = Date.parse(a?.last_seen_at || a?.started_at || ''); return Number.isFinite(t) && t >= floor })
  .sort((a, b) => String(b.last_seen_at || '').localeCompare(String(a.last_seen_at || '')))
}

/** One entry per child per standard: the unit both signals are judged on. */
export function groupByStudentStandard(attempts) {
 const out = new Map()
 for (const a of attempts || []) {
  if (!a?.student_id || !a?.standard_id) continue
  const key = `${a.student_id}|${a.standard_id}`
  const g = out.get(key) || { studentId: a.student_id, standardId: a.standard_id, classId: a.class_id ?? null, attempts: [], turns: 0, met: false, struggledVerdict: false, lastSeen: '' }
  g.attempts.push(a)
  g.turns += num(a.turns)
  if (a.verdict === 'met') g.met = true
  if (a.verdict === 'partly' || a.verdict === 'not_yet') g.struggledVerdict = true
  // The support condition travels with the group: a 'met' earned with the passage read
  // aloud is a different fact, and a reader who cannot see that will overstate the child.
  if (a.audio_on_assessed) g.audioOnAssessed = true
  if (a.alternate_standard) g.alternateStandard = true
  const seen = String(a.last_seen_at || a.started_at || '')
  if (seen > g.lastSeen) g.lastSeen = seen
  out.set(key, g)
 }
 return out
}

/**
 * Signal 1 — worked at it and it has not landed. A teaching question.
 *
 * Requires real effort, not just repetition: two attempts of two turns each is a child
 * leaving twice, and calling that "struggling with fractions" sends a coach to the wrong
 * problem. An explicit partly/not_yet verdict counts as struggle on its own, because VIC
 * saying so is stronger evidence than any turn count.
 */
export function workingNotLanding(attempts, opts = {}) {
 const groups = [...groupByStudentStandard(withinWindow(attempts, opts)).values()]
 return groups
  .filter(g => !g.met && (g.turns >= WORK_TURNS || g.struggledVerdict))
  .map(g => ({
   studentId: g.studentId,
   standardId: g.standardId,
   classId: g.classId,
   tries: g.attempts.length,
   turns: g.turns,
   toldNotYet: g.struggledVerdict,
   audioOnAssessed: Boolean(g.audioOnAssessed),
   alternateStandard: Boolean(g.alternateStandard),
   lastSeen: g.lastSeen,
   // A second try at the same standard with nothing to show for it is the strongest thing
   // in this data: every student-standard pair that reached a second attempt in the first
   // week ended without a met. Worth surfacing above a single long attempt.
   repeated: g.attempts.length >= 2,
  }))
  .sort((a, b) => Number(b.repeated) - Number(a.repeated) || b.turns - a.turns)
}

/**
 * Signal 2 — opening skills and leaving. A supervision question, not a teaching one.
 *
 * Counted per child rather than per standard, because the pattern is about the child's
 * morning, not about fractions. A child who also worked properly on something else that
 * week is still counted: the question is how much time is going nowhere.
 */
export function notEngaging(attempts, opts = {}) {
 const inWindow = withinWindow(attempts, opts)
 const byStudent = new Map()
 for (const a of inWindow) {
  if (!a?.student_id) continue
  const s = byStudent.get(a.student_id) || { studentId: a.student_id, classId: a.class_id ?? null, browsed: 0, worked: 0, lastSeen: '' }
  const effort = effortOf(a)
  if (effort === 'browsed' && a.verdict !== 'met') s.browsed++
  if (effort === 'worked') s.worked++
  const seen = String(a.last_seen_at || a.started_at || '')
  if (seen > s.lastSeen) s.lastSeen = seen
  byStudent.set(a.student_id, s)
 }
 return [...byStudent.values()]
  .filter(s => s.browsed >= BROWSE_FLAG)
  .sort((a, b) => b.browsed - a.browsed)
}

/**
 * The principal's number, which is about standards rather than children.
 *
 * Two reasons, and the second is the one that matters. A principal cannot act on
 * "Johnny is behind" -- that is the teacher's job -- but can act on "fractions came back
 * not-landed more than landed this week" by sending help to the room. And at Saint Peter's
 * size, groups of 10 to 13, almost every cut by child lands under five, so "2 children
 * below in fractions" names those two to anyone who can count.
 *
 * Children are still reachable per class, for the teacher who is supposed to know them.
 */
export function standardsRollup(attempts, opts = {}) {
 const groups = [...groupByStudentStandard(withinWindow(attempts, opts)).values()]
 const out = new Map()
 for (const g of groups) {
  const s = out.get(g.standardId) || { standardId: g.standardId, children: 0, landed: 0, notLanded: 0, started: 0 }
  s.children++
  if (g.met) s.landed++
  else if (g.turns >= WORK_TURNS || g.struggledVerdict) s.notLanded++
  else s.started++
  out.set(g.standardId, s)
 }
 return [...out.values()]
  // Where teaching is not working, hardest first. A standard nobody met and several worked
  // at is the one to walk into a classroom about.
  .sort((a, b) => (b.notLanded - b.landed) - (a.notLanded - a.landed) || b.children - a.children)
}

/** Everything a screen needs, from one list of rows. */
export function evidence(attempts, opts = {}) {
 return {
  struggling: workingNotLanding(attempts, opts),
  disengaged: notEngaging(attempts, opts),
  standards: standardsRollup(attempts, opts),
  windowDays: opts.days ?? WINDOW_DAYS,
 }
}

/** Plain-language summary of one standard's week, for a principal who is not reading a table. */
export function standardLine(row) {
 if (!row) return ''
 const { landed = 0, notLanded = 0, children = 0 } = row
 if (!children) return 'Nobody has worked on this yet.'
 if (notLanded > landed) return `${notLanded} of ${children} worked at it without getting there.`
 if (landed && !notLanded) return `${landed} of ${children} got there.`
 return `${landed} got there, ${notLanded} did not.`
}

// Teacher hiring: the default question set, the rubrics, and the validation that guards them.
// Based on Dr. Rob Furman's own process -- the screener he used on nearly a thousand resumes for one
// elementary opening, and the video screening Saint Peter's runs today.
//
// The look-fors matter more than the questions. Anyone can list ten interview questions; a scorer
// facing a blank "Look for..." column invents their own bar, and three scorers invent three. Each
// question below carries what a strong answer sounds like and what a weak one sounds like, and the
// review screen shows both beside the recording.
//
// The through-line of the whole rubric, in Rob's words: anyone can give you the textbook answer.
// Score the stories -- a real child, a real week, the thing that did not work, what they changed.
//
// Note the weighting this produces: five written answers at 13 points each outweigh five video
// answers at 10. If that is ever the wrong balance, change the maxima here -- the stage totals
// below are derived from these numbers rather than typed, so nothing else needs touching.

export const STAGES = ['video', 'written', 'interview']

// What a scorer is actually judging, and in what order. Two numbers on every answer, three on a
// written one.
//
// Content and fit are deliberately separate. They answer different questions and they come apart
// more often than people expect: a technically excellent answer can describe a school that is not
// this one, and a modest answer can come from someone who clearly belongs here. Collapsing them
// into a single impression is how a panel ends up arguing without knowing what it disagrees about.
export const SCORE_DIMENSIONS = [
 {
  key: 'content', label: 'Content', max: 5,
  help: 'Is the answer any good? Real children, real classrooms, specifics rather than the textbook version.',
 },
 {
  key: 'fit', label: 'Fit', max: 5,
  help: 'Would this answer work here? Does it match how this school teaches and what it expects of a teacher.',
 },
 {
  key: 'writing', label: 'Writing', max: 3, writtenOnly: true,
  help: 'Grammar, clarity, professional tone. Teachers write to families constantly, and an error rate becomes the principal\u2019s problem in week three.',
 },
]

export const DEFAULT_VIDEO_QUESTIONS = [
 {
  ordinal: 1, domain: 'Opener',
  prompt: 'Tell us about yourself. How have your background, experience and strengths prepared you to be an effective teacher at this school?',
  look_for_strong: 'Gets to the point inside the first fifteen seconds. Frames their background around children and what children got out of it, not around their own career ladder. Picks the two or three experiences that bear on this job and leaves the rest out. Finishes in about two minutes and knows it is finished.',
  look_for_weak: 'A chronological walk through every job since college. Rambles past four minutes with no shape. Talks about what the roles gave them rather than what they gave students. Cannot tell what is relevant from what is not.',
 },
 {
  ordinal: 2, domain: 'Classroom challenge',
  prompt: 'Describe a time when you faced a difficult challenge in the classroom and what you did to overcome it.',
  look_for_strong: 'One specific situation, one specific child or class, a particular week. Names what they tried first and that it did not work. Says what they changed and what happened next. Mentions who they pulled in -- a colleague, a coach, the family. Owns a mistake without flinching.',
  look_for_weak: 'A general philosophy of challenges instead of a challenge. Stays hypothetical ("what I would do is..."). A story where they were the hero and nothing went wrong. The problem is always the child, the family, or the last administration, never anything they could control.',
 },
 {
  ordinal: 3, domain: 'Lesson design',
  prompt: 'Walk us through a typical lesson plan, including how you align instruction with Florida state standards. Then share your favorite lesson you have taught and explain what made it successful.',
  look_for_strong: 'Starts from the standard and the objective, then works backward to how they will know children got it. Treats the standard as the thing being taught rather than a code written at the top of a plan. Describes checking for understanding mid-lesson and what they do when half the room has not got it. The favorite lesson is a real lesson with real children in it, and the reason it worked is about what children did, not about how much fun it was.',
  look_for_weak: 'A list of activities with no objective underneath. Standards mentioned as paperwork, or not at all. Cannot say how they would know whether the lesson worked. A favorite lesson that is mostly a craft, a video, or a party. "Fun" and "engaging" doing all the work with no mechanism behind them.',
 },
 {
  ordinal: 4, domain: 'Expectations and authority',
  prompt: 'How do you establish classroom expectations and authority while building a welcoming, positive learning environment during the first week of school?',
  look_for_strong: 'Structure before consequences -- routines taught and practiced explicitly, not announced. Knows what the first five minutes of day one look like. Holds a firm line and a warm room at the same time, and does not treat those as a trade-off. Treats behavior as information about a child. Distinguishes a child having a hard time from a child giving her one.',
  look_for_weak: 'Consequences first, or a tour of a behavior chart with no instruction in it. Rules posted on day one and never taught again. At the other extreme, "I build relationships and I never have behavior problems" -- which means they have not run a room, or are not telling you about the children they could not reach. Any contempt for children or families, however lightly worded: that one is disqualifying on its own.',
 },
 {
  ordinal: 5, domain: 'Closer',
  prompt: 'Why should we hire you?',
  look_for_strong: 'Names one or two specific strengths and attaches evidence to each. Connects their strength to something this school actually needs. Comfortable and humble at the same time. A bit of humor here is a good sign.',
  look_for_weak: 'Superlatives with nothing behind them -- best, most passionate, hardest-working. Comparing themselves to candidates they have never met. Or the opposite failure: so self-deprecating they never answer. Anyone who cannot advocate for themselves in an interview will struggle to advocate for a child in an IEP meeting.',
 },
]

// Written answers carry a third number. Teachers write to families constantly, and a cover-letter
// error rate becomes the principal's problem in week three.
export const DEFAULT_WRITTEN_QUESTIONS = [
 {
  ordinal: 1, domain: 'Motivation', max_content: 5, max_fit: 5, max_writing: 3,
  prompt: 'How do you motivate students?',
  look_for_strong: 'Distinguishes motivating a class from reaching one child. Names something they did that worked and something that did not. Does not rely on prizes and points as the whole answer.',
  look_for_weak: 'Motivation as a personality trait they happen to have. Rewards systems with nothing underneath. No child anywhere in the answer.',
 },
 {
  ordinal: 2, domain: 'Management', max_content: 5, max_fit: 5, max_writing: 3,
  prompt: 'Describe your classroom management structure.',
  look_for_strong: 'An actual structure -- routines, transitions, what the first week looks like. Says what happens when the structure fails.',
  look_for_weak: 'A philosophy rather than a structure. Nothing about the first week, transitions, or what happens when it breaks down.',
 },
 {
  ordinal: 3, domain: 'Differentiation', max_content: 5, max_fit: 5, max_writing: 3,
  prompt: 'In your class you have Student A, who is two years below expectations, and Student B, who is one year above. How will you differentiate instruction so that every child in that room grows? Please be specific.',
  look_for_strong: 'Specific: same objective, different entry points, named strategies, grouping, what each child is doing at 10:15. Addresses the child who is ahead as well as the one behind.',
  look_for_weak: 'Generic differentiation language with no mechanism. Forgets Student B entirely, which most candidates do -- the child who is ahead is the one schools quietly stop teaching.',
 },
 {
  ordinal: 4, domain: 'Collegiality', max_content: 5, max_fit: 5, max_writing: 3,
  prompt: 'Tell us about the principal and the colleagues you worked with most closely in your last position. What was that working relationship like, and what did you take from it?',
  look_for_strong: 'Speaks about former colleagues and administrators with professionalism, including where they disagreed. Can name something they learned from someone else.',
  look_for_weak: 'Trashes a former principal or colleagues, in writing, to a stranger, during an interview. They will do the same about you in the parking lot in March. When a hire goes wrong it is almost never the teaching -- it is attitude, and this is the cheapest early read on it.',
 },
 {
  ordinal: 5, domain: 'Trauma', max_content: 5, max_fit: 5, max_writing: 3,
  prompt: 'What impact does trauma have on student learning, and how do you address that in your classroom?',
  look_for_strong: 'Real understanding that behavior can be a stress response, paired with holding expectations. Knows the boundary of their role and when to involve counseling or administration.',
  look_for_weak: 'Either lowers the bar for children in hard circumstances, or treats trauma as an excuse to be managed. Claims a clinical role they do not have.',
 },
]

// Round two, in person. The first six are the domains every education interview covers. The last
// four are the ones most schools never ask, and they cover the failure mode that actually costs a
// school a year: not the teaching, the attitude.
export const DEFAULT_INTERVIEW_QUESTIONS = [
 { ordinal: 1, domain: 'Opener', prompt: 'Tell us about yourself as it relates to this position.', max_content: 5, max_fit: 5 },
 { ordinal: 2, domain: 'Data', prompt: 'Walk us through a time you looked at student data and changed what you were doing because of it.', max_content: 5, max_fit: 5 },
 { ordinal: 3, domain: 'Management', prompt: 'What is your secret to maintaining order in your classroom, and how do you handle a child who will not stay on task?', max_content: 5, max_fit: 5 },
 { ordinal: 4, domain: 'Parent communication', prompt: 'Tell us about a difficult conversation with a parent. How did you open it, and where did it end?', max_content: 5, max_fit: 5 },
 { ordinal: 5, domain: 'Differentiation', prompt: 'How do you adapt instruction for the range of needs in one room? Tell us about a child with an IEP you taught well.', max_content: 5, max_fit: 5 },
 { ordinal: 6, domain: 'Closer', prompt: 'Why should we hire you?', max_content: 5, max_fit: 5 },
 {
  ordinal: 7, domain: 'Collegiality', max_content: 5, max_fit: 5,
  prompt: 'Tell us about a time you disagreed with a decision from your administration. What did you do?',
  look_for_strong: 'Raised it directly, then supported the decision publicly while continuing to make their case privately.',
  look_for_weak: 'Went quiet and complained sideways, or went over the principal’s head first.',
 },
 {
  ordinal: 8, domain: 'Collegiality', max_content: 5, max_fit: 5,
  prompt: 'What is something a colleague does better than you, and what did you take from them?',
  look_for_strong: 'Names a person and a specific practice they borrowed.',
  look_for_weak: 'Cannot think of one, or names a fake weakness. An inability to admire a peer is a warning.',
 },
 {
  ordinal: 9, domain: 'Collegiality', max_content: 5, max_fit: 5,
  prompt: 'Tell us about a school initiative you did not love. How did you handle it?',
  look_for_strong: 'Honest that they disagreed, professional about implementation, looked for the part they could get behind.',
  look_for_weak: 'Either total compliance with no judgment, or a story that is still clearly a grievance.',
 },
 {
  ordinal: 10, domain: 'Collegiality', max_content: 5, max_fit: 5,
  prompt: 'What do you need from a principal to do your best work?',
  look_for_strong: 'Concrete and reasonable -- clear expectations, feedback, backup with families.',
  look_for_weak: 'Nothing at all, or a list that reads as a set of conditions. Also tells you whether you can give them what they need.',
 },
]

// The pre-interview screener. Scored from the application alone, before any contact, by the
// principal. Twelve points, and the cutoff used is recorded rather than remembered.
//
// GPA is a tiebreaker tier and not a gate. The floor is 2.5, and in shortage fields -- SPED, math,
// science, dual-language -- it is waived outright. A hard 3.5 cutoff screens out strong
// career-changers and, in a hard-to-staff role, can leave a school with no pool at all.
export const SCREENER_LINES = [
 { key: 'gpa_25', label: 'Undergraduate GPA 2.5 to 2.99', points: 1, group: 'gpa' },
 { key: 'gpa_30', label: 'Undergraduate GPA 3.0 to 3.49', points: 2, group: 'gpa' },
 { key: 'gpa_35', label: 'Undergraduate GPA 3.5 and above', points: 3, group: 'gpa' },
 { key: 'grad_gpa', label: 'Graduate GPA above 3.75', points: 1 },
 { key: 'multi_cert', label: 'Multiple certifications', points: 1 },
 { key: 'experience', label: 'More than one year of related teaching experience', points: 2 },
 { key: 'longevity', label: 'Three or more years in a single previous position', points: 2 },
 { key: 'content_exam', label: 'State content exam scores at or above average', points: 1 },
 { key: 'extracurricular', label: 'Extracurricular or club leadership potential', points: 1 },
 { key: 'prior_sub', label: 'Previously substituted or worked in this school', points: 1 },
 { key: 'cover_letter', label: 'Professional, specific, error-free cover letter', points: 1 },
]

// Nothing here scores where a candidate lives, their age, family status, or national origin. If a
// future screener line looks like it needs one of those, it does not.
//
// Computed, not typed. Mutually exclusive tiers contribute their best line, not their sum, and a
// hand-written total goes stale the first time somebody adds a screener line and forgets.
export const SCREENER_MAX = (() => {
 const groups = new Map()
 let total = 0
 for (const line of SCREENER_LINES) {
  if (!line.group) { total += line.points; continue }
  groups.set(line.group, Math.max(groups.get(line.group) || 0, line.points))
 }
 for (const best of groups.values()) total += best
 return total
})()

// Round three. The heaviest round, and the only one that is evidence rather than prediction.
export const DEMO_RUBRIC = [
 { key: 'objective', label: 'Objective and purpose', max: 10, look_for: 'Children can say what they are learning and why. The lesson actually teaches the stated objective.' },
 { key: 'opening', label: 'Opening', max: 10, look_for: 'Gets going within two minutes. Activates what children already know. No dead time while materials get sorted.' },
 { key: 'instruction', label: 'Instruction and modeling', max: 15, look_for: 'Explains clearly, shows before asking, checks whether the explanation landed before moving on.' },
 { key: 'thinking', label: 'Children doing the thinking', max: 15, look_for: 'Students talk, write, work and struggle productively. The teacher is not performing at them for twenty minutes.' },
 { key: 'cfu', label: 'Checking for understanding', max: 10, look_for: 'Finds out mid-lesson who has it and who does not, by some means other than "any questions?"' },
 { key: 'profile', label: 'Responsiveness to the class profile', max: 10, look_for: 'Visibly plans for the below-level readers, the ELLs, the IEP, and the four who finish early. Adjusts live when something is not working.' },
 { key: 'climate', label: 'Management and climate', max: 10, look_for: 'Clear expectations, warm tone, redirects without stopping the lesson. Children look safe.' },
]

export const PLAN_RUBRIC = [
 { key: 'plan_quality', label: 'Written plan quality', max: 5, look_for: 'Objective, sequence, materials, assessment. Specific enough that someone else could teach it.' },
 { key: 'rationale', label: 'Rationale for this class', max: 5, look_for: 'The three to five sentences connect their choices to these particular children, not to a generic class.' },
 { key: 'originality', label: 'Originality and adaptation', max: 5, look_for: 'Built or genuinely adapted, not downloaded intact. If adapted, they can say what they changed and why. A downloaded lesson is not disqualifying -- a hidden one is.' },
 { key: 'self_assessment', label: 'Self-assessment in the debrief', max: 5, look_for: 'Asked "how did that go?", they can name what worked, what did not, and what they would change. Coachable beats polished.' },
]

// The class profile that makes a purchased lesson fall apart. A standard on its own is a search
// term -- three candidates once arrived with the same bought lesson for the same objective. A
// standard plus a roomful of specific children is a teaching problem.
export const DEMO_CLASS_PROFILE =
 '22 children. Three read roughly two years below grade level. One has an IEP for processing speed and needs extra time to respond. ' +
 'Two are English language learners at different levels of proficiency -- one conversational, one newly arrived. ' +
 'Four have already mastered this objective and will finish early.'

// Every stage total is derived from the rubric that produces it, so the grand total cannot drift
// away from the sheets a panel actually fills in.
const sumQuestions = list => list.reduce((a, q) => a + (q.max_content ?? 5) + (q.max_fit ?? 5) + (q.max_writing ?? 0), 0)
export const STAGE_TOTALS = {
 screener: SCREENER_MAX,
 video: sumQuestions(DEFAULT_VIDEO_QUESTIONS),
 written: sumQuestions(DEFAULT_WRITTEN_QUESTIONS),
 interview: sumQuestions(DEFAULT_INTERVIEW_QUESTIONS),
 demo: DEMO_RUBRIC.reduce((a, r) => a + r.max, 0),
 plan: PLAN_RUBRIC.reduce((a, r) => a + r.max, 0),
}
export const GRAND_TOTAL = Object.values(STAGE_TOTALS).reduce((a, b) => a + b, 0)

// Invitation codes. Not a password, but the only thing in front of someone else's application, so
// it has to be unguessable and it has to expire. Letters and digits a candidate can read off an
// email and type without asking which character that is: no O/0, I/1, l.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export function makeInviteCode(rand = Math.random) {
 let out = ''
 for (let i = 0; i < 12; i++) out += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)]
 return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}`
}
export function normalizeInviteCode(v) {
 const bare = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
 return bare.length === 12 ? `${bare.slice(0, 4)}-${bare.slice(4, 8)}-${bare.slice(8, 12)}` : ''
}

const text = (v, max, label) => {
 const s = typeof v === 'string' ? v.trim() : ''
 if (s.length > max) throw new Error(`Keep ${label} under ${max.toLocaleString()} characters.`)
 return s
}

export function candidateInput(raw) {
 const name = text(raw?.name, 160, 'the candidate’s name')
 if (name.length < 2) throw new Error('Add the candidate’s name.')
 const email = text(raw?.email, 254, 'the email address').toLowerCase()
 if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) throw new Error('Add a valid email address for the candidate.')
 return {
  name, email,
  phone: text(raw?.phone, 40, 'the phone number'),
  certAreas: text(raw?.certAreas, 400, 'the certification areas'),
 }
}

export function screenerTotal(points) {
 let total = 0
 const groups = new Map()
 for (const line of SCREENER_LINES) {
  if (!points?.[line.key]) continue
  // GPA tiers are mutually exclusive, and a 3.6 earns the three-point line -- not one plus two
  // plus three, and not the first tier that happens to be listed. Take the best selected tier.
  if (line.group) {
   groups.set(line.group, Math.max(groups.get(line.group) || 0, line.points))
   continue
  }
  total += line.points
 }
 for (const best of groups.values()) total += best
 return Math.min(total, SCREENER_MAX)
}

// Each panel member's scores are summed, and the highest total advances. No one holds a veto,
// including the principal. A candidate with fewer scorers than the rest is flagged rather than
// silently ranked lower -- an unscored answer is a missing scorer, not a zero.
export function rankCandidates(rows) {
 return [...(rows || [])]
  .map(r => ({ ...r, total: Number(r.total) || 0, scorers: Number(r.scorers) || 0 }))
  .sort((a, b) => b.total - a.total || String(a.name || '').localeCompare(String(b.name || '')))
}

export function seedQuestions(postingId, schoolId) {
 const rows = []
 const push = (stage, list) => {
  for (const q of list) {
   rows.push({
    school_id: schoolId, posting_id: postingId, stage,
    ordinal: q.ordinal, prompt: q.prompt, domain: q.domain || '',
    look_for_strong: q.look_for_strong || '', look_for_weak: q.look_for_weak || '',
    max_content: q.max_content ?? 5, max_fit: q.max_fit ?? 5, max_writing: q.max_writing ?? 0,
   })
  }
 }
 push('video', DEFAULT_VIDEO_QUESTIONS)
 push('written', DEFAULT_WRITTEN_QUESTIONS)
 push('interview', DEFAULT_INTERVIEW_QUESTIONS)
 return rows
}

// The packet. Every round a candidate can go through, in order, with where its points come from.
//
// Optional rounds are optional on purpose: not every position gets a demo lesson, and a school
// hiring one aide from four applicants does not need a scored resume screen. A round nobody used
// contributes nothing and is never shown as a zero -- a skipped round and a round scored zero are
// different things, and a packet that confuses them makes a candidate look worse than they were.
export const ROUNDS = [
 {
  key: 'screener', label: 'Screening round', optional: true, kind: 'checklist', lines: SCREENER_LINES,
  blurb: 'Scored from the resume and cover letter alone, before any contact. The volume filter.',
 },
 {
  key: 'video', label: 'Video interview', optional: false, kind: 'answers',
  blurb: 'Five recorded answers, scored on content and fit.',
 },
 {
  key: 'written', label: 'Written responses', optional: false, kind: 'answers',
  blurb: 'Five written answers, scored on content, fit and writing.',
 },
 {
  key: 'demo', label: 'Performance round', optional: true, kind: 'rubric', lines: DEMO_RUBRIC,
  blurb: 'The teaching demonstration. The only round that is evidence rather than prediction.',
 },
 {
  key: 'plan', label: 'Plan and debrief', optional: true, kind: 'rubric', lines: PLAN_RUBRIC,
  blurb: 'Their written plan, their rationale for this class, and how they talk about the lesson afterwards.',
 },
]

export const roundByKey = key => ROUNDS.find(r => r.key === key) || null

// Totals a checklist or rubric round from the lines actually earned. Unknown keys are ignored
// rather than trusted, so a stale or hand-edited payload cannot inflate a total.
export function roundTotal(roundKey, points) {
 const round = roundByKey(roundKey)
 if (!round?.lines) return 0
 if (round.kind === 'checklist') {
  let total = 0
  const groups = new Map()
  for (const line of round.lines) {
   if (!points?.[line.key]) continue
   if (line.group) { groups.set(line.group, Math.max(groups.get(line.group) || 0, line.points)); continue }
   total += line.points
  }
  for (const best of groups.values()) total += best
  return Math.min(total, roundMax(roundKey))
 }
 let total = 0
 for (const line of round.lines) {
  const value = Number(points?.[line.key])
  if (!Number.isFinite(value) || value <= 0) continue
  total += Math.min(Math.round(value), line.max)
 }
 return Math.min(total, roundMax(roundKey))
}

export function roundMax(roundKey) {
 const round = roundByKey(roundKey)
 if (!round?.lines) return STAGE_TOTALS[roundKey] || 0
 if (round.kind === 'checklist') {
  const groups = new Map()
  let total = 0
  for (const line of round.lines) {
   if (!line.group) { total += line.points; continue }
   groups.set(line.group, Math.max(groups.get(line.group) || 0, line.points))
  }
  for (const best of groups.values()) total += best
  return total
 }
 return round.lines.reduce((a, l) => a + l.max, 0)
}

// What the packet shows. Rounds that were never scored are marked skipped and contribute nothing
// to either the earned total or the possible total, so a candidate who did four rounds is not
// compared against a candidate who did six.
export function packet(rows) {
 const used = []
 let earned = 0
 let possible = 0
 for (const round of ROUNDS) {
  const row = (rows || []).find(r => r.key === round.key)
  if (!row || row.scored === false) { used.push({ ...round, lines: undefined, scored: false, skipped: row?.skipped === true }); continue }
  earned += Number(row.total) || 0
  possible += Number(row.max) || 0
  used.push({ ...round, lines: undefined, scored: true, total: Number(row.total) || 0, max: Number(row.max) || 0, scorers: Number(row.scorers) || 0 })
 }
 return { rounds: used, earned, possible, percent: possible ? Math.round((earned / possible) * 100) : null }
}

// The ladder a candidate climbs, and how far up it they are.
//
// Each rung lights when that round has been scored. A rung a school deliberately skipped is marked
// as skipped and stops being a gate -- not every position gets a demo lesson, and a candidate
// should not be stuck one rung short forever because their school does not run a resume screen.
//
// A fully lit ladder does not hire anybody. It means every round this school chose to run has been
// scored and the panel can now make a decision -- which, when several candidates finish level, is
// a conversation around a table and sometimes the superintendent, not an arithmetic result.
export const LADDER = [
 { key: 'screener', label: 'Screening' },
 { key: 'video', label: 'Video' },
 { key: 'written', label: 'Written' },
 { key: 'demo', label: 'Performance' },
 { key: 'plan', label: 'Debrief' },
]

export const STOPPED_STAGES = ['declined', 'withdrawn']

export function ladderState(rounds, stage) {
 const byKey = new Map((rounds || []).map(r => [r.key, r]))
 const segments = LADDER.map(seg => {
  const row = byKey.get(seg.key)
  if (row?.scored) return { ...seg, state: 'lit', total: row.total, max: row.max, scorers: row.scorers || 0 }
  if (row?.skipped) return { ...seg, state: 'skipped' }
  return { ...seg, state: 'waiting' }
 })
 const stopped = STOPPED_STAGES.includes(stage)
 const hired = stage === 'hired'
 const lit = segments.filter(s => s.state === 'lit').length
 const waiting = segments.filter(s => s.state === 'waiting')
 return {
  segments,
  lit,
  skipped: segments.filter(s => s.state === 'skipped').length,
  // Every rung either scored or deliberately skipped, and at least one actually scored: an
  // all-skipped ladder is not a finished candidate, it is an empty one.
  complete: lit > 0 && waiting.length === 0,
  next: waiting[0] || null,
  stopped,
  hired,
 }
}

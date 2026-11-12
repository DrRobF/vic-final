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

export const STAGES = ['video', 'written', 'interview']

export const DEFAULT_VIDEO_QUESTIONS = [
 {
  ordinal: 1, domain: 'Opener',
  prompt: 'Tell us about yourself and your experience as it pertains to the position for which you are interviewing.',
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
  prompt: 'What is your process for building a lesson that is effective, interesting and genuinely interactive?',
  look_for_strong: 'Starts from the standard and the objective, then works backward to how they will know children got it. Describes checking for understanding mid-lesson and what they do when half the room has not got it. Names actual materials or routines. Interactive means children doing the thinking.',
  look_for_weak: 'A list of activities with no objective underneath. Technology as the answer to every question. Cannot say how they would know whether the lesson worked. "Fun" and "engaging" doing all the work with no mechanism behind them.',
 },
 {
  ordinal: 4, domain: 'Discipline',
  prompt: 'How do you approach discipline, and what role does it play in learning?',
  look_for_strong: 'Structure before consequences -- routines, expectations taught explicitly, the first five minutes of class. Treats behavior as information about a child. Distinguishes a child having a hard time from a child giving her one. Has a concrete escalation path and knows when it leaves the room. Still holds a firm line; warmth is not permissiveness.',
  look_for_weak: 'Consequences first, or a tour of a behavior chart with no instruction in it. At the other extreme, "I build relationships and I never have behavior problems" -- which means they have not run a room, or are not telling you about the children they could not reach. Sending children out as the primary tool. Any contempt for children or families, however lightly worded: that one is disqualifying on its own.',
 },
 {
  ordinal: 5, domain: 'Closer',
  prompt: 'Why should we hire you?',
  look_for_strong: 'Names one or two specific strengths and attaches evidence to each. Connects their strength to something this school actually needs. Comfortable and humble at the same time. A bit of humor here is a good sign.',
  look_for_weak: 'Superlatives with nothing behind them -- best, most passionate, hardest-working. Comparing themselves to candidates they have never met. Or the opposite failure: so self-deprecating they never answer. Anyone who cannot advocate for themselves in an interview will struggle to advocate for a child in an IEP meeting.',
 },
]

// Written answers are scored 3 for content and 1 for writing quality. Teachers write to families
// constantly, and a cover-letter error rate becomes the principal's problem in week three.
export const DEFAULT_WRITTEN_QUESTIONS = [
 {
  ordinal: 1, domain: 'Motivation', max_substance: 3, max_delivery: 1,
  prompt: 'How do you motivate students?',
  look_for_strong: 'Distinguishes motivating a class from reaching one child. Names something they did that worked and something that did not. Does not rely on prizes and points as the whole answer.',
  look_for_weak: 'Motivation as a personality trait they happen to have. Rewards systems with nothing underneath. No child anywhere in the answer.',
 },
 {
  ordinal: 2, domain: 'Management', max_substance: 3, max_delivery: 1,
  prompt: 'Describe your classroom management structure.',
  look_for_strong: 'An actual structure -- routines, transitions, what the first week looks like. Says what happens when the structure fails.',
  look_for_weak: 'A philosophy rather than a structure. Nothing about the first week, transitions, or what happens when it breaks down.',
 },
 {
  ordinal: 3, domain: 'Differentiation', max_substance: 3, max_delivery: 1,
  prompt: 'In your class you have Student A, who is two years below expectations, and Student B, who is one year above. How will you differentiate instruction so that every child in that room grows? Please be specific.',
  look_for_strong: 'Specific: same objective, different entry points, named strategies, grouping, what each child is doing at 10:15. Addresses the child who is ahead as well as the one behind.',
  look_for_weak: 'Generic differentiation language with no mechanism. Forgets Student B entirely, which most candidates do -- the child who is ahead is the one schools quietly stop teaching.',
 },
 {
  ordinal: 4, domain: 'Collegiality', max_substance: 3, max_delivery: 1,
  prompt: 'Tell us about the principal and the colleagues you worked with most closely in your last position. What was that working relationship like, and what did you take from it?',
  look_for_strong: 'Speaks about former colleagues and administrators with professionalism, including where they disagreed. Can name something they learned from someone else.',
  look_for_weak: 'Trashes a former principal or colleagues, in writing, to a stranger, during an interview. They will do the same about you in the parking lot in March. When a hire goes wrong it is almost never the teaching -- it is attitude, and this is the cheapest early read on it.',
 },
 {
  ordinal: 5, domain: 'Trauma', max_substance: 3, max_delivery: 1,
  prompt: 'What impact does trauma have on student learning, and how do you address that in your classroom?',
  look_for_strong: 'Real understanding that behavior can be a stress response, paired with holding expectations. Knows the boundary of their role and when to involve counseling or administration.',
  look_for_weak: 'Either lowers the bar for children in hard circumstances, or treats trauma as an excuse to be managed. Claims a clinical role they do not have.',
 },
]

// Round two, in person. The first six are the domains every education interview covers. The last
// four are the ones most schools never ask, and they cover the failure mode that actually costs a
// school a year: not the teaching, the attitude.
export const DEFAULT_INTERVIEW_QUESTIONS = [
 { ordinal: 1, domain: 'Opener', prompt: 'Tell us about yourself as it relates to this position.', max_substance: 5, max_delivery: 0 },
 { ordinal: 2, domain: 'Data', prompt: 'Walk us through a time you looked at student data and changed what you were doing because of it.', max_substance: 5, max_delivery: 0 },
 { ordinal: 3, domain: 'Management', prompt: 'What is your secret to maintaining order in your classroom, and how do you handle a child who will not stay on task?', max_substance: 5, max_delivery: 0 },
 { ordinal: 4, domain: 'Parent communication', prompt: 'Tell us about a difficult conversation with a parent. How did you open it, and where did it end?', max_substance: 5, max_delivery: 0 },
 { ordinal: 5, domain: 'Differentiation', prompt: 'How do you adapt instruction for the range of needs in one room? Tell us about a child with an IEP you taught well.', max_substance: 5, max_delivery: 0 },
 { ordinal: 6, domain: 'Closer', prompt: 'Why should we hire you?', max_substance: 5, max_delivery: 0 },
 {
  ordinal: 7, domain: 'Collegiality', max_substance: 5, max_delivery: 0,
  prompt: 'Tell us about a time you disagreed with a decision from your administration. What did you do?',
  look_for_strong: 'Raised it directly, then supported the decision publicly while continuing to make their case privately.',
  look_for_weak: 'Went quiet and complained sideways, or went over the principal’s head first.',
 },
 {
  ordinal: 8, domain: 'Collegiality', max_substance: 5, max_delivery: 0,
  prompt: 'What is something a colleague does better than you, and what did you take from them?',
  look_for_strong: 'Names a person and a specific practice they borrowed.',
  look_for_weak: 'Cannot think of one, or names a fake weakness. An inability to admire a peer is a warning.',
 },
 {
  ordinal: 9, domain: 'Collegiality', max_substance: 5, max_delivery: 0,
  prompt: 'Tell us about a school initiative you did not love. How did you handle it?',
  look_for_strong: 'Honest that they disagreed, professional about implementation, looked for the part they could get behind.',
  look_for_weak: 'Either total compliance with no judgment, or a story that is still clearly a grievance.',
 },
 {
  ordinal: 10, domain: 'Collegiality', max_substance: 5, max_delivery: 0,
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
const sumQuestions = list => list.reduce((a, q) => a + (q.max_substance ?? 8) + (q.max_delivery ?? 2), 0)
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
    max_substance: q.max_substance ?? 8, max_delivery: q.max_delivery ?? 2,
   })
  }
 }
 push('video', DEFAULT_VIDEO_QUESTIONS)
 push('written', DEFAULT_WRITTEN_QUESTIONS)
 push('interview', DEFAULT_INTERVIEW_QUESTIONS)
 return rows
}

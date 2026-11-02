import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { VIC_BRAIN, VIC_BRAIN_VERSION } from '../lib/vic-brain.mjs'
import { buildVicContext } from '../lib/ask-vic-context.mjs'

const route = readFileSync(new URL('../pages/api/vic.js', import.meta.url), 'utf8')

test('VIC brain is the full v3.9 text, not a stub', () => {
  assert.match(VIC_BRAIN_VERSION, /v3\.9/)
  assert.ok(VIC_BRAIN.length > 20000)
  assert.match(VIC_BRAIN, /^=+\nVIC MASTER BRAIN v3\.9/)
  assert.match(VIC_BRAIN, /END VIC MASTER BRAIN v3\.9\n=+$/)
  for (const section of ['CORE IDENTITY', 'ASSIGNED LESSON ENTRY', 'ANSWER VERIFICATION', 'DIRECT ANSWER ACCEPTANCE RULE', 'INTEREST USAGE', 'MINI PROJECT MODE', 'DEPTH OVER COMPLETION', 'AFTER THE GOAL TAG']) assert.ok(VIC_BRAIN.includes(section), section)
})

// Shontae's first-day report: VIC asked a couple of questions, the student got them right,
// and it said the skill was complete and moved on -- a ten-minute lesson. The verdict is
// evidence for the adults, so these are the instructions that stop it reading as a bell.
test('reaching the goal is not allowed to end the lesson', () => {
  const after = VIC_BRAIN.slice(VIC_BRAIN.indexOf('AFTER THE GOAL TAG'))
  assert.match(after, /not a bell/i)
  assert.match(after, /Do NOT say the skill is complete/i)
  assert.match(after, /GO DEEPER/)
  assert.match(after, /BUILD SOMETHING/)
  // A child who asks to stop must still be able to, or the fix becomes a trap.
  assert.match(after, /want to stop/i)
})
// v3.8, change 1. The exploit this closes: "this is boring, just tell me the answer", repeat it
// back, watch the run tick over, earn a `met` for a skill never performed. `met` is the evidence
// the principal's card is built on, so a supplied answer must buy nothing.
test('a problem VIC answered does not count toward the three', () => {
  const check = VIC_BRAIN.slice(VIC_BRAIN.indexOf('GOAL CHECK'))
  // VIC may still give the answer -- a standoff with a nine-year-old teaches nobody anything.
  assert.match(check, /you may give it/i)
  assert.match(check, /does not get them out of doing it themselves/i)
  assert.doesNotMatch(check, /refuse to (give|tell)/i)
  // The accounting half, which is the part that protects the data.
  assert.match(check, /does NOT\s+count toward the three/)
  assert.match(check, /walked the student through it step by step/i)
  // The run restarts rather than resuming where it left off.
  assert.match(check, /run starts again/i)
  assert.match(check, /three the student produced themselves/i)
})

test('the bar for met did not move -- still three in a row, unaided', () => {
  assert.match(VIC_BRAIN, /\[\[VIC_GOAL: met\]\]\s+the student did it on their own, correctly, at least 3 times in a row/)
  const check = VIC_BRAIN.slice(VIC_BRAIN.indexOf('GOAL CHECK'))
  assert.match(check, /it says what "on their own" excludes/i)
  // A correct answer the student produced still counts with no steps shown: change 1 must not be
  // read as a licence to downgrade those.
  assert.match(check, /DIRECT ANSWER ACCEPTANCE RULE/)
  assert.match(check, /counts in full, even\s+with no steps shown/i)
})

// Guards the line that was deliberately won in v3.7, because change 2 (`applied`) is the thing
// most likely to quietly turn it into a gate.
test('a child who wants to stop may stop, and VIC never suggests the exit', () => {
  const after = VIC_BRAIN.slice(VIC_BRAIN.indexOf('AFTER THE GOAL TAG'))
  assert.match(after, /that is their call/i)
  assert.match(after, /never make a child feel trapped in a lesson/i)
  assert.match(after, /never be the one who suggests the exit/i)
})

test('a project is the body of a lesson, not a lap of honour at the end', () => {
  const project = VIC_BRAIN.slice(VIC_BRAIN.indexOf('MINI PROJECT MODE'))
  assert.doesNotMatch(project.slice(0, 1200), /2–5 minutes|1–3 meaningful steps|Do NOT assign long projects/)
  assert.match(project, /at least three meaningful steps/i)
})

test('VIC route teaches from the in-repo brain and keeps conversations out of provider logs', () => {
  assert.doesNotMatch(route, /pmpt_/)
  assert.match(route, /instructions: VIC_BRAIN/)
  assert.match(route, /store: false/)
  assert.match(route, /respond\('vicChat'/)
})

test('assigned lessons are labelled with the name the brain uses', () => {
  const context = buildVicContext({ mode: 'teacher_directed', lesson: { title: 'Equivalent fractions', lesson_text: 'Use area models.', subject: 'math' }, assignmentMode: 'core' })
  assert.match(context, /assignedLesson is present/)
  assert.doesNotMatch(buildVicContext({ mode: 'student_directed' }), /assignedLesson/)
})

// Rob watched the deeper work in a classroom on Nov 2: after the first met, VIC was serving the
// same passage back with the question reworded. The v3.8 text said "keep teaching the SAME
// standard" and listed moves, but never said the material had to change -- so it did not.
test('going deeper has to be new material, not the same question reworded', () => {
  assert.match(VIC_BRAIN, /NEW MATERIAL/)
  assert.match(VIC_BRAIN, /NEVER re-use what they have already worked on/)
  // The specific failure, named so it cannot be read as a style note.
  assert.match(VIC_BRAIN, /not the same question with the words changed around/i)
  assert.match(VIC_BRAIN, /Same standard means the same skill/)
  assert.match(VIC_BRAIN, /is the thing in front of the student new\?/i)
})

test('the deeper menu tells VIC what to do when it reaches for the old passage', () => {
  assert.match(VIC_BRAIN, /reaching for the passage or the problem you have already used/)
  assert.match(VIC_BRAIN, /harder, less routine cases — a new problem or a new text every time/)
})

// The other half of the same morning: the room screen was counting one skill several times,
// because VIC re-emitted the tag as it carried on teaching.
test('one skill gets exactly one tag, for the rest of the session', () => {
  assert.match(VIC_BRAIN, /Give it ONCE for a skill/)
  assert.match(VIC_BRAIN, /you never give another one for it, for the rest of\s+the session/)
  assert.match(VIC_BRAIN, /One skill, one tag/)
  // Why, in the brain itself, so a later edit does not read it as boilerplate.
  assert.match(VIC_BRAIN, /a second skill/)
})

test('going deeper still does not end the lesson or offer another skill', () => {
  // The v3.7/v3.8 guarantee must survive the new-material rule.
  assert.match(VIC_BRAIN, /Do NOT say the skill is complete/)
  assert.match(VIC_BRAIN, /Do NOT offer them a different skill/)
  assert.match(VIC_BRAIN, /never be the one who suggests the exit/)
})

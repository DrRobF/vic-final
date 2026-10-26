import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { VIC_BRAIN, VIC_BRAIN_VERSION } from '../lib/vic-brain.mjs'
import { buildVicContext } from '../lib/ask-vic-context.mjs'

const route = readFileSync(new URL('../pages/api/vic.js', import.meta.url), 'utf8')

test('VIC brain is the full v3.7 text, not a stub', () => {
  assert.match(VIC_BRAIN_VERSION, /v3\.7/)
  assert.ok(VIC_BRAIN.length > 20000)
  assert.match(VIC_BRAIN, /^=+\nVIC MASTER BRAIN v3\.7/)
  assert.match(VIC_BRAIN, /END VIC MASTER BRAIN v3\.7\n=+$/)
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

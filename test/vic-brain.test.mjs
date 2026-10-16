import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { VIC_BRAIN, VIC_BRAIN_VERSION } from '../lib/vic-brain.mjs'
import { buildVicContext } from '../lib/ask-vic-context.mjs'

const route = readFileSync(new URL('../pages/api/vic.js', import.meta.url), 'utf8')

test('VIC brain is the full v3.5 text, not a stub', () => {
  assert.match(VIC_BRAIN_VERSION, /v3\.5/)
  assert.ok(VIC_BRAIN.length > 20000)
  assert.match(VIC_BRAIN, /^=+\nVIC MASTER BRAIN v3\.5/)
  assert.match(VIC_BRAIN, /END VIC MASTER BRAIN v3\.5\n=+$/)
  for (const section of ['CORE IDENTITY', 'ASSIGNED LESSON ENTRY', 'ANSWER VERIFICATION', 'DIRECT ANSWER ACCEPTANCE RULE', 'INTEREST USAGE', 'MINI PROJECT MODE', 'DEPTH OVER COMPLETION']) assert.ok(VIC_BRAIN.includes(section), section)
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

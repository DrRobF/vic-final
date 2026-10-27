import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { extractGoal } from '../lib/vic-goal.mjs'
import { extractVisual } from '../lib/vic-visuals.mjs'
import { detectSafety } from '../lib/vic-safety.mjs'
import { buildVicContext, normalizeSessionMode, selectActiveEnrollment, TEACHER_DIRECTED } from '../lib/ask-vic-context.mjs'
import { splitText, buildSpeech, policyForLesson, sessionInstructions } from '../lib/read-aloud.mjs'

const general = JSON.parse(readFileSync(new URL('../data/lesson-standards.json', import.meta.url), 'utf8'))
const access = JSON.parse(readFileSync(new URL('../data/access-points.json', import.meta.url), 'utf8'))
const READING = 'FL:ELA.3.R.1.1'  // assessed on reading: passage must be held back
const MATH = 'FL:MA.3.AR.1.1'     // reading is not the point: everything may be spoken

// Runs the real handler with a fake model and a fake database, and reports what the model was
// told and what the child would receive.
async function run({ standard = READING, supports = null, modelReply, subject = 'ELA & Social Studies' } = {}) {
 const seen = { input: null, goalRows: [] }
 const src = readFileSync(new URL('../pages/api/vic.js', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?from\s+'[^']+'\n/gm, '')
  .replace('export const config', 'const config')
  .replace('export default async function handler', 'async function handler') + '\nthis.handler=handler'
 const tables = {
  enrollments: [{ class_id: 40, support_level: 'core', classes: { id: 40, grade_level: 3 } }],
  assignments: [{ id: 5, lesson_id: 7, mode: 'on-level', status: 'assigned', assigned_at: 'x', lessons: { id: 7, class_id: 40 } }],
  lessons: [{ id: 7, class_id: 40, subject, title: 'Practice', lesson_text: 'RL: explain how a character changes', is_active: true, practice_standard: standard }],
  student_supports: supports ? [supports] : [],
 }
 const db = {
  from(table) {
   const rows = () => tables[table] || []
   const b = {
    select: () => b, eq: () => b, or: () => b, order: () => b, limit: () => b, not: () => b, gte: () => b, in: () => b,
    insert(row) { if (table === 'vic_goal_results') seen.goalRows.push(row); return Promise.resolve({ error: null }) },
    upsert: () => Promise.resolve({ error: null }),
    maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
    then: (res, rej) => Promise.resolve({ data: rows(), error: null }).then(res, rej),
   }
   return b
  },
 }
 const context = {
  console: { error() {} }, URL,
  requireApprovedProfile: async () => ({ profile: { id: 112, role: 'student', interest_tags: [] }, admin: db }),
  releasedFilter: () => 'x', vicTargetText: () => 'x',
  extractGoal, extractVisual, detectSafety, buildVicContext, normalizeSessionMode, selectActiveEnrollment, TEACHER_DIRECTED,
  splitText, buildSpeech, policyForLesson, sessionInstructions,
  general, access,
  VIC_BRAIN: 'BRAIN',
  respond: async (_name, body) => { seen.input = body.input; return { response: { ok: true }, data: { text: modelReply }, model: 'm' } },
  outputText: d => d.text,
  raiseSafetyAlert: async () => {},
 }
 vm.createContext(context); vm.runInContext(src, context)
 const res = { code: 200, body: null, setHeader() {}, status(c) { this.code = c; return this }, json(b) { this.body = b; return this } }
 await context.handler({ method: 'POST', body: { messages: [{ role: 'user', content: 'ready' }], sessionMode: 'teacher_directed', activeClassId: 40, assignedLessonId: 7 } }, res)
 return { res, system: seen.input?.[0]?.content || '' }
}

const reader = { read_aloud: 'on_request', language: 'en', alternate_standards: false }
const passage = 'Read this and tell me who is sad. [[TEXT]]Mia dropped her ice cream and cried.[[/TEXT]] Take your time.'

test('a reading skill for a child with read-aloud: VIC is told to mark the passage', async () => {
 const { system } = await run({ supports: reader, modelReply: passage })
 assert.match(system, /\[\[TEXT\]\]/)
})

test('the child sees the full passage, the speech plan holds it back, and tags are gone', async () => {
 const { res } = await run({ supports: reader, modelReply: passage })
 assert.equal(res.code, 200)
 assert.doesNotMatch(res.body.reply, /\[\[/)
 assert.match(res.body.reply, /ice cream and cried/)      // the child can still read it
 assert.equal(res.body.speech.available, true)
 assert.match(res.body.speech.text, /who is sad/)
 assert.doesNotMatch(res.body.speech.text, /ice cream|cried/) // but it is not spoken
 assert.equal(res.body.speech.heldBack, true)
})

test('an untagged reply on a reading skill is not spoken at all', async () => {
 const { res } = await run({ supports: reader, modelReply: 'Here is a story. Mia dropped her ice cream. What happened?' })
 assert.equal(res.body.speech.available, false)
 assert.equal(res.body.speech.reason, 'unmarked')
 assert.match(res.body.reply, /ice cream/)
})

test('a math skill is spoken in full and VIC is not given the passage rules', async () => {
 const { res, system } = await run({ standard: MATH, subject: 'Math & Science', supports: reader, modelReply: 'Mia has 3 bags with 4 apples. How many apples?' })
 assert.doesNotMatch(system, /\[\[TEXT\]\]/)
 assert.equal(res.body.speech.available, true)
 assert.match(res.body.speech.text, /3 bags with 4 apples/)
})

test('Spanish: VIC is told to write in Spanish and the plan names the language', async () => {
 const { res, system } = await run({ standard: MATH, subject: 'Math & Science', supports: { ...reader, language: 'es' }, modelReply: 'Mia tiene 3 bolsas. ¿Cuántas manzanas?' })
 assert.match(system, /Spanish/)
 assert.equal(res.body.speech.language, 'es')
})

test('a child with nothing switched on gets exactly what they got before', async () => {
 for (const supports of [null, { read_aloud: 'off', language: 'en', alternate_standards: false }]) {
  const { res, system } = await run({ supports, modelReply: passage })
  assert.doesNotMatch(system, /\[\[TEXT\]\]|LANGUAGE\./)
  assert.equal('speech' in res.body, false, 'no speech key at all')
  assert.doesNotMatch(res.body.reply, /\[\[/, 'stray tags are still stripped')
 }
})

test('a verdict is still recorded for a child using read-aloud', async () => {
 const { res } = await run({ supports: reader, modelReply: 'You did it! [[NO_TEXT]]\n[[VIC_GOAL: met]]' })
 assert.equal(res.body.goal, 'met')
})

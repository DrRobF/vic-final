import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { permissionsFor, parseSettings, refusedChanges, SUBJECTS, ALTERNATE_STANDARDS_HELP } from '../lib/learner-settings.mjs'

// ---- the rules ------------------------------------------------------------------------------

test('a teacher of the student may change the level but not alternate standards', () => {
 const p = permissionsFor({ teaches: true })
 assert.equal(p.level, true)
 assert.equal(p.alternateStandards, false)
})

test('a teacher who does not teach the student may change nothing', () => {
 assert.deepEqual(Object.values(permissionsFor({})).filter(Boolean), [])
})

test('a school leader may change everything', () => {
 assert.deepEqual(Object.values(permissionsFor({ leader: true })).filter(v => !v), [])
})

test('levels must be whole numbers from 0 to 12, and null clears one', () => {
 assert.deepEqual(parseSettings({ levels: { reading: 1, math: '8' } }).levels, { reading: 1, math: 8 })
 assert.deepEqual(parseSettings({ levels: { math: null } }).levels, { math: null })
 assert.equal(parseSettings({ levels: { reading: 0 } }).ok, true) // kindergarten is a real level
 for (const bad of [13, -1, 1.5, 'abc', '']) assert.equal(parseSettings({ levels: { reading: bad } }).ok, false, String(bad))
 assert.equal(parseSettings({ levels: { science: 3 } }).ok, false)
})

test('only the fields mentioned are returned, so one change never resets another', () => {
 const p = parseSettings({ supports: { language: 'es' } })
 assert.deepEqual(p.supports, { language: 'es' })
 assert.deepEqual(p.levels, {})
})

test('an empty or invalid request is refused with a reason', () => {
 assert.equal(parseSettings({}).ok, false)
 assert.equal(parseSettings({ supports: { read_aloud: 'loud' } }).ok, false)
 assert.equal(parseSettings({ supports: { alternate_standards: 'yes' } }).ok, false)
})

test('saving a value that is already set is not a change, so a full form is never blocked', () => {
 const parsed = parseSettings({ supports: { alternate_standards: false } })
 assert.deepEqual(refusedChanges(parsed, permissionsFor({ teaches: true }), { alternate_standards: false }), [])
 // But actually turning it on is refused.
 const on = parseSettings({ supports: { alternate_standards: true } })
 assert.deepEqual(refusedChanges(on, permissionsFor({ teaches: true }), { alternate_standards: false }), ['alternate standards'])
})

// ---- the endpoint ---------------------------------------------------------------------------

function load({ leader = false, mine = [], enrolled = [], student = { id: 112, name: 'Kyaunna', role: 'student', grade_level: 6 }, levels = [], supports = null, profile = { id: 9, role: 'teacher' } } = {}) {
 const log = { upserts: [], deletes: [] }
 const src = readFileSync(new URL('../pages/api/teacher/learner-settings.js', import.meta.url), 'utf8')
  .replace(/^import .*\n/gm, '').replace('export default async function handler', 'async function handler') + '\nthis.handler=handler'
 const db = {
  from(table) {
   const rows = () => ({ users: student ? [student] : [], classes: mine, enrollments: enrolled, student_levels: levels, student_supports: supports ? [supports] : [] }[table] || [])
   const b = {
    select: () => b, eq: () => b, in: () => b, limit: () => b,
    upsert(row) { log.upserts.push({ table, row }); return Promise.resolve({ error: null }) },
    delete: () => ({ eq: () => ({ eq(col, val) { log.deletes.push({ table, val }); return Promise.resolve({ error: null }) } }) }),
    maybeSingle: async () => ({ data: rows()[0] ?? null }),
    then: (res, rej) => Promise.resolve({ data: rows(), error: null }).then(res, rej),
   }
   return b
  },
 }
 const context = {
  console: { error() {} },
  requireLessonEducator: async () => ({ user: { id: 'auth-1' }, profile, admin: db }),
  isLeader: async () => leader,
  permissionsFor, parseSettings, refusedChanges, SUBJECTS, ALTERNATE_STANDARDS_HELP,
 }
 vm.createContext(context); vm.runInContext(src, context)
 return { handler: context.handler, log }
}
const call = async (h, { method = 'POST', body = {}, query = {} } = {}) => {
 const res = { code: 200, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v }, status(c) { this.code = c; return this }, json(b) { this.body = b; return this } }
 await h({ method, body, query }, res); return res
}

test('a teacher sets Kyaunna to Grade 1 reading and math, confirmed and attributed', async () => {
 const { handler, log } = load({ mine: [{ id: 40 }], enrolled: [{ id: 1 }] })
 const r = await call(handler, { body: { studentId: 112, levels: { reading: 1, math: 1 } } })
 assert.equal(r.code, 200)
 assert.equal(log.upserts.length, 2)
 for (const u of log.upserts) {
  assert.equal(u.table, 'student_levels')
  assert.equal(u.row.level, 1)
  assert.equal(u.row.source, 'teacher')
  assert.equal(u.row.set_by, 'auth-1')
  assert.ok(u.row.confirmed_at, 'a human chose it, so it is confirmed')
 }
})

test('a teacher who does not teach the child is refused and nothing is written', async () => {
 const { handler, log } = load({ mine: [{ id: 40 }], enrolled: [] })
 const r = await call(handler, { body: { studentId: 112, levels: { reading: 1 } } })
 assert.equal(r.code, 403)
 assert.deepEqual(log.upserts, [])
})

test('a teacher cannot turn on alternate standards, and nothing is written', async () => {
 const { handler, log } = load({ mine: [{ id: 40 }], enrolled: [{ id: 1 }] })
 const r = await call(handler, { body: { studentId: 112, supports: { alternate_standards: true } } })
 assert.equal(r.code, 403)
 assert.match(r.body.error, /school leader/i)
 assert.deepEqual(log.upserts, [])
})

test('a refused field also stops the allowed fields in the same request', async () => {
 // All or nothing: a half-saved IEP-adjacent change is worse than a clear refusal.
 const { handler, log } = load({ mine: [{ id: 40 }], enrolled: [{ id: 1 }] })
 const r = await call(handler, { body: { studentId: 112, levels: { reading: 1 }, supports: { alternate_standards: true } } })
 assert.equal(r.code, 403)
 assert.deepEqual(log.upserts, [])
})

test('a school leader may turn alternate standards on', async () => {
 const { handler, log } = load({ leader: true })
 const r = await call(handler, { body: { studentId: 112, supports: { alternate_standards: true } } })
 assert.equal(r.code, 200)
 assert.equal(log.upserts[0].table, 'student_supports')
 assert.equal(log.upserts[0].row.alternate_standards, true)
})

test('clearing a level deletes it rather than storing a nothing', async () => {
 const { handler, log } = load({ mine: [{ id: 40 }], enrolled: [{ id: 1 }], levels: [{ subject: 'reading', level: 1 }] })
 const r = await call(handler, { body: { studentId: 112, levels: { reading: null } } })
 assert.equal(r.code, 200)
 assert.deepEqual(log.deletes, [{ table: 'student_levels', val: 'reading' }])
 assert.deepEqual(log.upserts, [])
})

test('anything that is not a student looks like it does not exist', async () => {
 const { handler } = load({ leader: true, student: { id: 5, name: 'Staff', role: 'teacher' } })
 assert.equal((await call(handler, { body: { studentId: 5, levels: { math: 3 } } })).code, 404)
 assert.equal((await call(load({ student: null }).handler, { body: { studentId: 5, levels: { math: 3 } } })).code, 404)
})

test('a free Lesson Designer account with no school profile is turned away', async () => {
 const { handler } = load({ profile: null })
 assert.equal((await call(handler, { body: { studentId: 112, levels: { math: 3 } } })).code, 403)
})

test('reading what is set tells a teacher who to ask about alternate standards', async () => {
 const { handler } = load({ mine: [{ id: 40 }], enrolled: [{ id: 1 }], levels: [{ subject: 'reading', level: 1, source: 'teacher', confirmed_at: 'x' }] })
 const r = await call(handler, { method: 'GET', query: { studentId: '112' } })
 assert.equal(r.code, 200)
 assert.equal(r.body.levels.reading.level, 1)
 assert.equal(r.body.levels.math, null)
 assert.equal(r.body.can.alternateStandards, false)
 assert.match(r.body.help, /school leader/i)
})

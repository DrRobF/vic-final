import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { createHash } from 'node:crypto'
import { tidyCoverCode, COVER_CODE, grantUsable, COVER_REFUSALS } from '../lib/cover.mjs'

// The handler is loaded into a sandbox so the rules can be tested without a database.
function load({ grant = null, today = '2026-10-26', allowed = true, planned = [], launched = null, classes = [] } = {}) {
 const calls = { launches: [], plannedFor: [] }
 const src = readFileSync(new URL('../pages/api/cover/index.js', import.meta.url), 'utf8')
  .replace(/^import .*\n/gm, '').replace('export const ', 'const ')
  .replace('export default async function handler', 'async function handler') + '\nthis.handler=handler'
 const context = {
  console: { error() {} }, createHash,
  tidyCoverCode, COVER_CODE, grantUsable, COVER_REFUSALS,
  schoolToday: () => today,
  plannedToday: async (_db, ids) => { calls.plannedFor.push([...ids]); return planned },
  launchLesson: async (_db, body) => { calls.launches.push(body); return launched || { launched: 7 } },
  serviceDb: () => ({
   rpc: async () => ({ data: allowed, error: null }),
   // Table-aware and awaitable: the handler reads the grant with maybeSingle and the class
   // list by awaiting the builder itself, so the mock has to answer both shapes.
   from(table) {
    const rows = table === 'classes' ? classes : table === 'ap_schools' ? [{ name: 'Saint Peter\'s Academy' }] : [grant]
    const q = {
     select() { return q }, eq() { return q }, in() { return q }, order() { return q }, update() { return q },
     maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
     then: (resolve, reject) => Promise.resolve({ data: rows, error: null }).then(resolve, reject),
    }
    return q
   },
  }),
 }
 vm.createContext(context); vm.runInContext(src, context)
 return { run: context.handler, calls }
}
const res = () => ({ setHeader() {}, status(c) { this.code = c; return this }, json(d) { this.data = d; return this } })
const post = body => ({ method: 'POST', headers: {}, socket: { remoteAddress: '127.0.0.1' }, body })
const GRANT = { id: 'g1', school_id: 's1', day: '2026-10-26', class_ids: [36, 37], covering_name: 'Amber Manuel', note: '', revoked_at: null }

test('A malformed code is refused before any lookup', async () => {
 for (const code of ['', 'ABC', 'ABCD234', undefined, '!!!', '12-34']) {
  const { run, calls } = load({ grant: GRANT }), r = res()
  await run(post({ code }), r)
  assert.equal(r.code, 400)
  assert.equal(calls.plannedFor.length, 0)
 }
})
test('An unknown code never reveals that it is unknown rather than revoked', async () => {
 const a = res(); await load({ grant: null }).run(post({ code: 'ABCD2345' }), a)
 const b = res(); await load({ grant: { ...GRANT, revoked_at: '2026-10-26T08:00:00Z' } }).run(post({ code: 'ABCD2345' }), b)
 assert.equal(a.data.error, b.data.error)
})
test('A code for another day cannot open or launch', async () => {
 const { run, calls } = load({ grant: { ...GRANT, day: '2026-10-23' } }), r = res()
 await run(post({ code: 'ABCD2345', action: 'launch', classId: 36, lessonId: 'L1' }), r)
 assert.equal(r.code, 403)
 assert.equal(calls.launches.length, 0)
})
test('Rate limiting stops code guessing before the code is looked up', async () => {
 const { run, calls } = load({ grant: GRANT, allowed: false }), r = res()
 await run(post({ code: 'ABCD2345' }), r)
 assert.equal(r.code, 429)
 assert.equal(calls.plannedFor.length, 0)
})

test('A class outside the slip is refused even with a working code', async () => {
 const { run, calls } = load({ grant: GRANT, planned: [{ lessonId: 'L9', classId: 99, ready: true }] }), r = res()
 await run(post({ code: 'ABCD2345', action: 'launch', classId: 99, lessonId: 'L9' }), r)
 assert.equal(r.code, 403)
 assert.match(r.data.error, /not on your cover slip/)
 assert.equal(calls.launches.length, 0)
})
test('Only the slip’s own classes are ever asked about', async () => {
 const { run, calls } = load({ grant: GRANT }), r = res()
 await run(post({ code: 'ABCD2345' }), r)
 assert.ok(calls.plannedFor.length > 0, 'nothing was looked up')
 for (const ids of calls.plannedFor) assert.equal([...ids].join(','), '36,37')
})
test('A lesson that is not planned for that class today cannot be launched', async () => {
 const { run, calls } = load({ grant: GRANT, planned: [{ lessonId: 'L1', classId: 36, ready: true }] }), r = res()
 await run(post({ code: 'ABCD2345', action: 'launch', classId: 37, lessonId: 'L1' }), r)
 assert.equal(r.code, 400)
 assert.equal(calls.launches.length, 0)
})
test('An unfinished lesson is refused with the practice fallback named', async () => {
 const { run, calls } = load({ grant: GRANT, planned: [{ lessonId: 'L1', classId: 36, ready: false }] }), r = res()
 await run(post({ code: 'ABCD2345', action: 'launch', classId: 36, lessonId: 'L1' }), r)
 assert.equal(r.code, 400)
 assert.match(r.data.error, /own practice/)
 assert.equal(calls.launches.length, 0)
})
test('A planned, ready lesson on a granted class launches', async () => {
 const { run, calls } = load({ grant: GRANT, planned: [{ lessonId: 'L1', classId: 36, ready: true }] }), r = res()
 await run(post({ code: 'ABCD2345', action: 'launch', classId: 36, lessonId: 'L1' }), r)
 assert.equal(r.data.launched, 7)
 assert.equal(calls.launches.length, 1)
 assert.equal(calls.launches[0].classId, 36)
 assert.equal(calls.launches[0].lessonId, 'L1')
})
test('Opening a slip never returns the teacher’s plan, only what it is called', async () => {
 const planned = [{ lessonId: 'L1', classId: 36, title: 'Area of rectangles', objective: 'Find area by tiling', ready: true, live: false }]
 const classes = [{ id: 36, class_name: '3/4 Math & Science', grade_level: 3, users: { name: 'Karen Green' } }]
 const { run } = load({ grant: GRANT, planned, classes }), r = res()
 await run(post({ code: 'ABCD2345' }), r)
 const body = JSON.stringify(r.data)
 assert.match(body, /Area of rectangles/)
 assert.equal(/draft|lesson_text|steps|plan"/.test(body), false, 'plan content leaked to the cover screen')
})
test('GET is refused: the code must not travel in a URL', async () => {
 const { run } = load({ grant: GRANT }), r = res()
 await run({ method: 'GET', headers: {}, query: { code: 'ABCD2345' }, socket: {} }, r)
 assert.equal(r.code, 405)
})

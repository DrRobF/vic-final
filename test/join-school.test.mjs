import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { normalizeJoinCode, JOIN_CONSENT } from '../lib/walkthrough.mjs'

// Tiny in-memory stand-in for the Supabase tables the route touches.
function fakeDb({ staff = [], schools = [] }) {
  const tables = { ap_staff: staff, ap_schools: schools, users: [{ auth_user_id: 'auth-new', name: 'New Teacher' }] }
  const updates = [], inserts = []
  function query(table) {
    let rows = tables[table].slice(), single = false, head = false
    const like = (v, p) => new RegExp('^' + p.replace(/\\([\\%_])|([%_])|([.*+?^${}()|[\]])/g, (m, esc, wild, meta) => esc ? '\\' + esc : wild === '%' ? '.*' : wild === '_' ? '.' : '\\' + meta) + '$', 'i').test(String(v || ''))
    const q = {
      select(cols, opts) { head = !!opts?.head; return q },
      eq(c, v) { rows = rows.filter(r => r[c] === v); return q },
      is(c, v) { rows = rows.filter(r => r[c] === v); return q },
      not(c, op, v) { rows = rows.filter(r => r[c] !== v); return q },
      ilike(c, p) { rows = rows.filter(r => like(r[c], p)); return q },
      limit() { return q },
      maybeSingle() { single = true; return q },
      update(patch) { return { eq: (c, v) => { updates.push({ table, patch, where: v }); return Promise.resolve({ error: null }) } } },
      insert(row) { inserts.push({ table, row }); return Promise.resolve({ error: null }) },
      then(ok, bad) {
        const withSchool = rows.map(r => table === 'ap_staff' ? { ...r, ap_schools: schools.find(s => s.id === r.school_id) } : r)
        const out = head ? { count: rows.length, error: null } : { data: single ? withSchool[0] || null : withSchool, error: null }
        return Promise.resolve(out).then(ok, bad)
      },
    }
    return q
  }
  return { from: query, updates, inserts }
}

function load(db, email) {
  const src = readFileSync(new URL('../pages/api/educator/join-school.js', import.meta.url), 'utf8')
    .replace(/^import .*\n/gm, '').replace(/export const /g, 'const ').replace('export default async function handler', 'async function handler') + '\nthis.handler=handler'
  const ctx = { console: { error() {} }, normalizeJoinCode, JOIN_CONSENT, requireLessonEducator: async () => ({ user: { id: 'auth-new', email }, admin: db }) }
  vm.createContext(ctx); vm.runInContext(src, ctx)
  return ctx.handler
}
const res = () => ({ setHeader() {}, status(c) { this.code = c; return this }, json(d) { this.data = JSON.parse(JSON.stringify(d)); return this } })
const SPA = { id: 1, name: "Saint Peter's Academy", join_code: 'SPA-4737', seat_limit: 50 }

test('a teacher the principal already listed is offered a one-click join', async () => {
  const db = fakeDb({ schools: [SPA], staff: [{ id: 10, school_id: 1, email: 'jane.smith@saintpetersacademy.org', active: true, auth_user_id: null }] })
  const r = res(); await load(db, 'Jane.Smith@saintpetersacademy.org')({ method: 'GET', query: {} }, r)
  assert.deepEqual(r.data.invites, [{ schoolId: 1, name: "Saint Peter's Academy" }])
  assert.equal(r.data.schools.length, 0)
})

test('one-click join links the listed spot without a code', async () => {
  const db = fakeDb({ schools: [SPA], staff: [{ id: 10, school_id: 1, email: 'jane.smith@saintpetersacademy.org', active: true, auth_user_id: null }] })
  const r = res(); await load(db, 'jane.smith@saintpetersacademy.org')({ method: 'POST', query: {}, body: { schoolId: 1, agree: true } }, r)
  assert.equal(r.data.joined, true)
  assert.equal(db.updates[0].where, 10)
  assert.equal(db.updates[0].patch.auth_user_id, 'auth-new')
})

test('a teacher not on the list cannot join a school by id, and must use the code', async () => {
  const db = fakeDb({ schools: [SPA], staff: [{ id: 10, school_id: 1, email: 'jane.smith@saintpetersacademy.org', active: true, auth_user_id: null }] })
  const r = res(); await load(db, 'stranger@gmail.com')({ method: 'POST', query: {}, body: { schoolId: 1, agree: true } }, r)
  assert.equal(r.code, 404)
  assert.equal(db.updates.length + db.inserts.length, 0)
})

test('an underscore in an email does not act as a wildcard', async () => {
  const db = fakeDb({ schools: [SPA], staff: [{ id: 10, school_id: 1, email: 'john@saintpetersacademy.org', active: true, auth_user_id: null }] })
  const get = res(); await load(db, 'j_hn@saintpetersacademy.org')({ method: 'GET', query: {} }, get)
  assert.deepEqual(get.data.invites, [])
  const post = res(); await load(db, 'j_hn@saintpetersacademy.org')({ method: 'POST', query: {}, body: { schoolId: 1, agree: true } }, post)
  assert.equal(post.code, 404)
})

test('joining by code still works and still needs agreement', async () => {
  const db = fakeDb({ schools: [SPA], staff: [] })
  const no = res(); await load(db, 'new@teacher.org')({ method: 'POST', query: {}, body: { code: 'spa-4737' } }, no)
  assert.equal(no.code, 400)
  const yes = res(); await load(db, 'new@teacher.org')({ method: 'POST', query: {}, body: { code: 'spa-4737', agree: true } }, yes)
  assert.equal(yes.data.joined, true)
  assert.equal(db.inserts[0].row.school_id, 1)
})

test('My Week shows the join card; the card handles invite and code', () => {
  const teach = readFileSync(new URL('../pages/teach.js', import.meta.url), 'utf8')
  assert.match(teach, /<JoinSchoolCard \/>/)
  const card = readFileSync(new URL('../components/JoinSchoolCard.js', import.meta.url), 'utf8')
  assert.match(card, /schoolId: invite\.schoolId/)
  assert.match(card, /\{ code \}/)
  assert.match(card, /if \(d\.schools\?\.length\) return/)
})

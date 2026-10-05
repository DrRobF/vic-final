import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { newPasswordError, requiresPasswordChange } from '../lib/password-policy.mjs'

function load(file, values) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8').replace(/^import .*\n/gm, '').replace('export default async function handler', 'async function handler') + '\nthis.handler = handler'
  const context = { process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public', SUPABASE_SERVICE_ROLE_KEY: 'server-only' } }, Date, ...values }
  vm.createContext(context); vm.runInContext(source, context); return context.handler
}
function response() { return { setHeader() {}, status(code) { this.code = code; return this }, json(data) { this.data = data; return this } } }
function passwordHandler(user, updates, updateError = null) {
  return load('../pages/api/change-password.js', { newPasswordError, requiresPasswordChange, readBearerToken: req => req.headers?.authorization,
    createClient: () => ({ auth: { getUser: async () => ({ data: { user }, error: null }), admin: { updateUserById: async (id, change) => { updates.push({ id, change }); return { error: updateError } } } },
      from: () => ({ select() { return this }, eq() { return this }, limit() { return this }, maybeSingle: async () => ({ data: { role: 'teacher' }, error: null }) }) }) })
}
test('first-login password change denies missing authentication and unmarked accounts', async () => {
  const updates = [], run = passwordHandler({ id: 'teacher', app_metadata: {} }, updates)
  let res = response(); await run({ method: 'POST', headers: {}, body: { password: 'personal-password' } }, res); assert.equal(res.code, 401)
  res = response(); await run({ method: 'POST', headers: { authorization: 'token' }, body: { password: 'personal-password' } }, res); assert.equal(res.code, 409); assert.equal(updates.length, 0)
})
test('personal password and required-change flag update together without losing other app metadata', async () => {
  const updates = [], run = passwordHandler({ id: 'teacher', app_metadata: { must_change_password: true, license: 'retain' } }, updates)
  let res = response(); await run({ method: 'POST', headers: { authorization: 'token' }, body: { password: 'spa2026' } }, res); assert.equal(res.code, 400); assert.equal(updates.length, 0)
  res = response(); await run({ method: 'POST', headers: { authorization: 'token' }, body: { password: 'personal-password' } }, res); assert.equal(res.code, 200)
  assert.equal(updates[0].id, 'teacher'); assert.equal(updates[0].change.password, 'personal-password'); assert.equal(updates[0].change.app_metadata.must_change_password, false); assert.equal(updates[0].change.app_metadata.license, 'retain')
})
test('Supabase rejection does not report a completed password change', async () => {
  const run = passwordHandler({ id: 'teacher', app_metadata: { must_change_password: true } }, [], { message: 'Weak password' }), res = response()
  await run({ method: 'POST', headers: { authorization: 'token' }, body: { password: 'personal-password' } }, res); assert.equal(res.code, 400); assert.equal(res.data.success, undefined)
})
test('another teacher cannot use the administrator reset', async () => {
  let calls = 0
  const run = load('../pages/api/admin/reset-staff-passwords.js', { ADMIN_EMAIL: 'drrobfurman@gmail.com', requireApprovedProfile: async () => ({ user: { id: 'other', email: 'another@school.org' }, profile: { role: 'teacher', email: 'another@school.org' }, admin: { from() { calls++; throw new Error('Must not access staff') } } }) }), res = response()
  await run({ method: 'POST', body: { confirm: 'reset-six-staff', password: 'spa2026' } }, res); assert.equal(res.code, 403); assert.equal(calls, 0)
})
test('reset targets only six existing teacher IDs and never repeats completed resets', async () => {
  const staff = Array.from({ length: 6 }, (_, i) => ({ id: 86 + i, name: `Teacher ${i}`, email: `teacher${i}@school.org`, auth_user_id: `staff-${i}`, role: 'teacher' })), changed = []
  const admin = { from: () => ({ select() { return this }, in(column, ids) { assert.equal(column, 'id'); assert.equal(JSON.stringify(ids), JSON.stringify([86,87,88,89,90,91])); return this }, eq: async (column, value) => { assert.equal(column, 'role'); assert.equal(value, 'teacher'); return { data: staff, error: null } } }), auth: { admin: {
    getUserById: async id => ({ data: { user: { id, email: staff.find(s => s.auth_user_id === id).email, app_metadata: id === 'staff-0' ? { temporary_password_batch: 'spa-staff-onboarding-2026-10-05' } : {} } } }),
    updateUserById: async (id, change) => { changed.push({ id, change }); return { error: null } },
  } } }
  const run = load('../pages/api/admin/reset-staff-passwords.js', { ADMIN_EMAIL: 'drrobfurman@gmail.com', requireApprovedProfile: async () => ({ user: { id: 'rob', email: 'drrobfurman@gmail.com' }, profile: { role: 'teacher', email: 'drrobfurman@gmail.com' }, admin }) }), res = response()
  await run({ method: 'POST', body: { confirm: 'reset-six-staff', password: 'spa2026' } }, res); assert.equal(res.code, 200); assert.equal(res.data.complete, true); assert.equal(changed.length, 5); assert.ok(changed.every(row => row.id !== 'rob' && row.change.app_metadata.must_change_password === true))
})

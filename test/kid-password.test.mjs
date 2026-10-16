import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { kidPassword, KID_ADJECTIVES, KID_NOUNS } from '../lib/kid-password.mjs'
import { newPasswordError } from '../lib/password-policy.mjs'

test('student passwords are two easy words and two digits', () => {
  for (let i = 0; i < 500; i++) {
    const p = kidPassword()
    assert.match(p, /^[a-z]+-[a-z]+-[2-9]{2}$/, p)
    assert.equal(newPasswordError(p), null, p)
    const [a, n] = p.split('-')
    assert.notEqual(a, n)
  }
})

test('no look-alike characters, no capitals, no symbols a child must hunt for', () => {
  for (let i = 0; i < 500; i++) assert.doesNotMatch(kidPassword(), /[A-Z0-1_.!@#$%^&*]/)
})

test('word lists are unique, short, lowercase, and large enough', () => {
  for (const list of [KID_ADJECTIVES, KID_NOUNS]) {
    assert.equal(new Set(list).size, list.length)
    assert.ok(list.length >= 100)
    for (const w of list) assert.match(w, /^[a-z]{3,8}$/, w)
  }
})

test('never repeats the same word twice', () => {
  const seq = [KID_ADJECTIVES.indexOf('giant'), KID_NOUNS.indexOf('giant'), KID_NOUNS.indexOf('tiger'), 0, 0]
  let i = 0
  assert.equal(kidPassword(() => seq[i++]), 'giant-tiger-22')
})

test('new student accounts use the kid password', () => {
  const route = readFileSync(new URL('../pages/api/admin/create-student.js', import.meta.url), 'utf8')
  assert.match(route, /const password=kidPassword\(\)/)
  assert.doesNotMatch(route, /randomBytes/)
})

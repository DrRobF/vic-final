import assert from 'node:assert/strict'
import test from 'node:test'
import { newPasswordError, requiresPasswordChange } from '../lib/password-policy.mjs'

test('only the administrator-controlled flag requires password change', () => {
  assert.equal(requiresPasswordChange({ app_metadata: { must_change_password: true } }), true)
  assert.equal(requiresPasswordChange({ user_metadata: { must_change_password: true } }), false)
  assert.equal(requiresPasswordChange({ app_metadata: { must_change_password: false } }), false)
})
test('temporary and oversized passwords cannot become personal passwords', () => {
  assert.ok(newPasswordError('spa2026'))
  assert.ok(newPasswordError('🙂'.repeat(19)))
  assert.equal(newPasswordError('Teacher-personal-2026'), null)
})

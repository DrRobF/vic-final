import test from 'node:test'
import assert from 'node:assert/strict'
import { appliesTo, commitmentStatus, mondayOf, periodFor, planningWeekFor, safeSourceUrl, schoolClock } from '../lib/assistant-principal-rules.mjs'

const lessonPlans = { cadence: 'weekly', due_weekday: 1, due_time: '10:00:00', enabled: true, applies_to: 'teachers' }

test('Monday deadline changes from due to overdue after 10:00 school time', () => {
  assert.equal(commitmentStatus(lessonPlans, null, { date: '2026-10-05', time: '09:59' }), 'due')
  assert.equal(commitmentStatus(lessonPlans, null, { date: '2026-10-05', time: '10:01' }), 'overdue')
  assert.equal(commitmentStatus(lessonPlans, { state: 'received' }, { date: '2026-10-05', time: '10:01' }), 'received')
})

test('weekly period resets on Monday, while daily period uses school date', () => {
  assert.equal(mondayOf('2026-10-04'), '2026-09-28')
  assert.equal(periodFor(lessonPlans, '2026-10-05'), '2026-10-05')
  assert.equal(periodFor({ cadence: 'daily' }, '2026-10-05'), '2026-10-05')
  assert.equal(planningWeekFor('2026-10-02'), '2026-10-05')
  assert.equal(planningWeekFor('2026-10-05'), '2026-10-05')
})

test('school time zone, role applicability and URL validation are explicit', () => {
  assert.deepEqual(schoolClock(new Date('2026-10-05T13:00:00Z'), 'America/New_York'), { date: '2026-10-05', time: '09:00' })
  assert.equal(appliesTo(lessonPlans, { role: 'office' }), false)
  assert.equal(appliesTo(lessonPlans, { role: 'teacher' }), true)
  assert.equal(safeSourceUrl('javascript:alert(1)'), null)
  assert.equal(safeSourceUrl('https://user:password@example.com'), null)
})

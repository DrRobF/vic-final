import test from 'node:test'
import assert from 'node:assert/strict'
import { stepHref, stepDone, doneCount, nextStep, updateSteps } from '../lib/lesson-steps.mjs'

const id = '11111111-2222-4333-8444-555555555555'
test('step links point at each lesson page', () => {
 assert.equal(stepHref('plan', id), `/lessonplan?lesson=${id}&view=lesson`)
 assert.equal(stepHref('print', id), `/lesson/print?id=${id}`)
 assert.equal(stepHref('follow', id), `/lesson/follow-up?id=${id}`)
})
test('plan counts as done once a lesson exists; next step follows order', () => {
 assert.equal(doneCount(undefined), 1)
 assert.equal(nextStep({}).key, 'print')
 assert.equal(nextStep({ print: '2026-10-13T00:00:00Z' }).key, 'teach')
 assert.equal(nextStep({ print: 'a', teach: 'b', follow: 'c' }), null)
 assert.equal(stepDone('teach', { teach: 'x' }), true)
})
test('marking steps keeps the first date and rejects unknown steps', () => {
 const a = updateSteps({}, 'print', true, 'd1')
 assert.deepEqual(updateSteps(a, 'print', true, 'd2'), { print: 'd1' })
 assert.deepEqual(updateSteps(a, 'print', false), {})
 assert.deepEqual(updateSteps({ junk: 1, teach: 'x' }, 'follow', true, 'd3'), { teach: 'x', follow: 'd3' })
 assert.throws(() => updateSteps({}, 'plan', true))
})

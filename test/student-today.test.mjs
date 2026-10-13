import test from 'node:test'
import assert from 'node:assert/strict'
import { modeLevel, studentWorksheet, cleanAnswers } from '../lib/student-today.mjs'

const sheet = { title: 'Fractions', versions: [
 { label: 'Version 1', level: 'Support', directions: 'd1', passage: '', questions: [{ prompt: 'p1', answer: 'SECRET' }] },
 { label: 'Version 2', level: 'On level', directions: 'd2', passage: '', questions: [{ prompt: 'p2', answer: 'SECRET' }] },
 { label: 'Version 3', level: 'Enrichment', directions: 'd3', passage: '', questions: [{ prompt: 'p3', answer: 'SECRET' }] },
] }
test('assignment modes map to level names', () => {
 assert.equal(modeLevel('remediation'), 'Support')
 assert.equal(modeLevel('on-level'), 'On level')
 assert.equal(modeLevel('enrichment'), 'Enrichment')
 assert.equal(modeLevel('weird'), 'On level')
})
test('students get their level version without answers or level names', () => {
 const w = studentWorksheet(sheet, 'enrichment')
 assert.equal(w.label, 'Version 3')
 assert.equal(w.questions[0].prompt, 'p3')
 assert.ok(!JSON.stringify(w).includes('SECRET'))
 assert.ok(!JSON.stringify(w).includes('Enrichment'))
 assert.equal(studentWorksheet(sheet, 'remediation').label, 'Version 1')
 assert.equal(studentWorksheet({ versions: [] }, 'core'), null)
})
test('older worksheets fall back to lesson groups', () => {
 const old = { title: 't', versions: [{ label: 'Version 1', questions: [] }, { label: 'Version 2', questions: [] }] }
 assert.equal(studentWorksheet(old, 'on-level', ['Support: x', 'On level: y']).label, 'Version 2')
})
test('answers are trimmed to the question count', () => {
 assert.deepEqual(cleanAnswers({ 0: 'a', 1: '  ', 5: 'z' }, 3), { 0: 'a' })
 assert.deepEqual(cleanAnswers(['x'], 3), {})
})

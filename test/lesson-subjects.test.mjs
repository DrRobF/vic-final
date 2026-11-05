import test from 'node:test'
import assert from 'node:assert/strict'
import catalogue from '../data/lesson-standards.json' with { type: 'json' }
import { PLANNER_SUBJECTS, hasCatalogue, subjectLabel, subjectOptions } from '../lib/lesson-subjects.mjs'
import { normalizeWeekSetup } from '../lib/lesson-week.mjs'

test('every catalogue subject is a subject the planner knows how to name', () => {
 for (const subject of new Set(catalogue.map(r => r.subject))) {
  assert.ok(PLANNER_SUBJECTS.includes(subject), `catalogue holds "${subject}" but the planner has no label for it`)
  assert.notEqual(subjectLabel(subject), subject)
 }
})

test('coverage map matches what the catalogue actually holds', () => {
 for (const row of catalogue) assert.ok(hasCatalogue(row.state, row.grade, row.subject), `${row.id} is in the catalogue but not in the coverage map — rerun scripts/build-standard-coverage.mjs`)
 assert.equal(hasCatalogue('PA', '3', 'science'), false)
})

test('Florida science and social studies are catalogued K-8', () => {
 for (const grade of ['K', '1', '2', '3', '4', '5', '6', '7', '8']) {
  for (const subject of ['science', 'socialstudies']) {
   assert.ok(hasCatalogue('FL', grade, subject), `FL ${subject} grade ${grade} is missing`)
  }
 }
})

test('an uncatalogued subject is offered as paste-a-standard, never as official', () => {
 const pa = subjectOptions('PA')
 assert.equal(pa.find(o => o.value === 'science').catalogued, false)
 assert.match(pa.find(o => o.value === 'science').label, /paste a standard/)
 assert.equal(subjectOptions('FL').find(o => o.value === 'socialstudies').catalogued, true)
})

test('no two catalogue rows share an id', () => {
 const seen = new Set()
 for (const row of catalogue) {
  assert.ok(!seen.has(row.id), `duplicate id ${row.id} — the planner resolves a saved standard by id and would pick the wrong grade`)
  seen.add(row.id)
 }
})

test('a banded SS.68 standard can be planned by a grade 7 teacher, not just grade 6', () => {
 const banded = catalogue.filter(r => r.code.startsWith('SS.68.'))
 assert.ok(banded.length > 0)
 const seventh = banded.find(r => r.grade === '7')
 const days = Array.from({ length: 5 }, (_, i) => i === 0
  ? { off: false, standardIds: [seventh.id], customStandard: '', customCode: '', topic: '', lessonId: null }
  : { off: true, standardIds: [], customStandard: '', customCode: '', topic: '', lessonId: null })
 const week = normalizeWeekSetup({ id: crypto.randomUUID(), weekOf: '2026-11-09', state: 'FL', grade: '7', subject: 'socialstudies', minutes: 45, days, settings: {} }, catalogue)
 assert.equal(week.days[0].standards[0].code, seventh.code)
})

test('official standard wording is never empty or a stray heading', () => {
 for (const row of catalogue.filter(r => r.subject === 'science' || r.subject === 'socialstudies')) {
  assert.ok(row.text.length >= 12, `${row.id} has no usable wording`)
  assert.doesNotMatch(row.text, /Benchmark Clarifications|Clarification \d/, `${row.id} carried clarification text into the standard`)
 }
})

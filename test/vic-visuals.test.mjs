import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseVisual, extractVisual } from '../lib/vic-visuals.mjs'
import { VIC_BRAIN } from '../lib/vic-brain.mjs'

test('VIC picks the picture with a tag the student never sees', () => {
  const r = extractVisual('Yes, 3/8 is correct!\n\nIf 4 out of 8 beats are claps, what fraction is that?\n[[VIC_VISUAL: fraction 4/8]]')
  assert.deepEqual(r.visual, { type: 'fraction', numerator: 4, denominator: 8 })
  assert.doesNotMatch(r.text, /VIC_VISUAL/)
  assert.match(r.text, /what fraction is that\?$/)
})

test('every supported picture parses', () => {
  assert.deepEqual(parseVisual('compare 2/4 1/2'), { type: 'compare', fractions: [{ numerator: 2, denominator: 4 }, { numerator: 1, denominator: 2 }] })
  assert.deepEqual(parseVisual('numberline 0 10 7'), { type: 'numberline', start: 0, end: 10, mark: 7 })
  assert.deepEqual(parseVisual('array 3x4'), { type: 'array', rows: 3, columns: 4 })
  assert.deepEqual(parseVisual('ARRAY 3 × 4'), { type: 'array', rows: 3, columns: 4 })
})

test('bad or oversized pictures are dropped, not drawn wrong', () => {
  for (const spec of ['fraction 9/4', 'fraction 1/0', 'fraction 1/40', 'compare 1/2', 'numberline 0 100 5', 'numberline 5 1 3', 'numberline 0 10 11', 'array 30x4', 'pie 1/2', '', 'fraction three/eight']) assert.equal(parseVisual(spec), null, spec)
  const r = extractVisual('Try this.\n[[VIC_VISUAL: fraction 9/4]]')
  assert.equal(r.visual, null)
  assert.equal(r.text, 'Try this.')
})

test('only the first picture is kept, and every tag is removed', () => {
  const r = extractVisual('A\n[[VIC_VISUAL: fraction 1/2]]\n[[VIC_VISUAL: array 2x2]]')
  assert.deepEqual(r.visual, { type: 'fraction', numerator: 1, denominator: 2 })
  assert.equal(r.text, 'A')
})

test('no tag means no picture, even if the text mentions fractions', () => {
  assert.equal(extractVisual('Exactly — 3/4 is correct!').visual, null)
})

test('brain explains the tags; route sends the visual and never one with a safety reply', () => {
  assert.match(VIC_BRAIN, /\[\[VIC_VISUAL: fraction 3\/8\]\]/)
  assert.match(VIC_BRAIN, /not the student's last answer/)
  const route = readFileSync(new URL('../pages/api/vic.js', import.meta.url), 'utf8')
  assert.match(route, /const visual = safety\.category \? null : shown\.visual/)
  assert.match(route, /json\(\{ reply, visual, goal/)
})

test('the page draws what VIC chose instead of guessing', () => {
  const page = readFileSync(new URL('../pages/askvic.js', import.meta.url), 'utf8')
  assert.doesNotMatch(page, /inferVisualFromConversation|VisualCardRenderer|type: 'idle'/)
  assert.match(page, /const visual = data\.visual \|\| null/)
  assert.match(page, /<VICVisual visual=\{msg\.visual\} \/>/)
  assert.match(page, /<VICText text=\{msg\.text\} \/>/)
  const component = readFileSync(new URL('../components/VICVisual.js', import.meta.url), 'utf8')
  assert.doesNotMatch(component, /styles\./, 'component must not depend on outside style keys')
})

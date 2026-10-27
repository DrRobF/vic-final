import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildSpeech, policyForLesson, sessionInstructions, splitText, speakable, isAssessedPolicy } from '../lib/read-aloud.mjs'

const general = JSON.parse(readFileSync(new URL('../data/lesson-standards.json', import.meta.url), 'utf8'))
const std = id => general.find(s => s.id === id)
const reader = { read_aloud: 'on_request', language: 'en', alternate_standards: false }
const always = { read_aloud: 'always', language: 'en', alternate_standards: false }
const speech = (reply, policy, supports = reader, translate) => buildSpeech({ marked: splitText(reply), policy, supports, translate })

// ---- the thing that must never happen -------------------------------------------------------

test('the passage a child is being assessed on reading is never in the spoken text', () => {
 const reply = 'Read this and tell me who is sad.\n\n[[TEXT]]Mia dropped her ice cream. She sat down and cried.[[/TEXT]]\n\nTake your time.'
 const out = speech(reply, 'stem_only')
 assert.equal(out.available, true)
 assert.match(out.text, /Read this and tell me who is sad/)
 assert.match(out.text, /Take your time/)
 assert.doesNotMatch(out.text, /ice cream|cried|Mia/)
 assert.equal(out.heldBack, true)
})

test('decoding words are held back too, not only passages', () => {
 const out = speech('Sound out this word. [[TEXT]]thrill[[/TEXT]]', 'none')
 assert.doesNotMatch(out.text, /thrill/)
 assert.match(out.text, /Sound out this word/)
})

test('a reading skill with no tags and no NO_TEXT marker is silent rather than guessed', () => {
 // We cannot tell where the passage is, so reading it risks reading the assessed text.
 for (const policy of ['stem_only', 'none']) {
  const out = speech('Here is a story. Mia dropped her ice cream. What happened?', policy)
  assert.equal(out.available, false)
  assert.equal(out.reason, 'unmarked')
 }
})

test('an unclosed tag treats the rest of the message as the passage', () => {
 const out = speech('Read this: [[TEXT]]Mia dropped her ice cream and cried.', 'stem_only')
 assert.doesNotMatch(out.text || '', /ice cream|cried/)
})

test('a message that says it has no text to read can be spoken in full', () => {
 const out = speech('Great job finding the main idea! Let us look at another one. [[NO_TEXT]]', 'stem_only')
 assert.equal(out.available, true)
 assert.match(out.text, /Great job/)
 assert.doesNotMatch(out.text, /NO_TEXT/)
})

// ---- where audio is the point ---------------------------------------------------------------

test('a math word problem is read aloud in full', () => {
 const out = speech('Mia has 3 bags with 4 apples each. How many apples is that?', 'free')
 assert.equal(out.available, true)
 assert.match(out.text, /3 bags with 4 apples each/)
 assert.equal(out.heldBack, false)
})

test('tags are removed from what the child sees, whatever the policy', () => {
 const marked = splitText('Look: [[TEXT]]a cat sat[[/TEXT]] Now you try. [[NO_TEXT]]')
 assert.doesNotMatch(marked.text, /\[\[/)
 assert.match(marked.text, /a cat sat/)
})

test('a listening skill is spoken even when the child asked for no read-aloud but uses a language', () => {
 const out = speech('Listen, then tell me what you heard.', 'required', { ...reader, read_aloud: 'off', language: 'es' })
 assert.equal(out.available, true)
 assert.equal(out.language, 'es')
})

// ---- children on the defaults see no change -------------------------------------------------

test('a child with nothing switched on gets nothing at all', () => {
 const off = { read_aloud: 'off', language: 'en', alternate_standards: false }
 assert.equal(speech('Anything', 'free', off), null)
 assert.equal(sessionInstructions({ policy: 'stem_only', supports: off }), '')
 assert.equal(sessionInstructions({ policy: 'free', supports: undefined }), '')
})

test('read-aloud off with a language still returns a plan, but with no audio', () => {
 const out = speech('Hola, vamos a empezar.', 'free', { read_aloud: 'off', language: 'es' })
 assert.equal(out.available, false)
 assert.equal(out.reason, 'off')
})

test("'always' asks the screen to speak without being tapped; 'on request' does not", () => {
 assert.equal(speech('Count the stars.', 'free', always).auto, true)
 assert.equal(speech('Count the stars.', 'free', reader).auto, false)
})

// ---- what VIC is told -----------------------------------------------------------------------

test('tag instructions appear only for reading skills, only for a child using supports', () => {
 assert.match(sessionInstructions({ policy: 'stem_only', supports: reader }), /\[\[TEXT\]\]/)
 assert.match(sessionInstructions({ policy: 'none', supports: reader }), /\[\[NO_TEXT\]\]/)
 assert.doesNotMatch(sessionInstructions({ policy: 'free', supports: reader }) || '', /\[\[TEXT\]\]/)
})

test('Spanish: math is translated whole, reading keeps the English text in English', () => {
 const es = { ...reader, language: 'es' }
 assert.match(sessionInstructions({ policy: 'free', translate: 'free', supports: es }), /whole reply in Spanish/)
 const reading = sessionInstructions({ policy: 'stem_only', translate: 'scaffold_only', supports: es })
 assert.match(reading, /stays in English/)
 assert.match(reading, /Spanish/)
})

test('Haitian Creole is named and never routed through French', () => {
 const t = sessionInstructions({ policy: 'free', translate: 'free', supports: { ...reader, language: 'ht' } })
 assert.match(t, /Haitian Creole/)
 assert.doesNotMatch(t, /French/i)
})

// ---- which policy applies -------------------------------------------------------------------

test('a practice skill uses its own standard; unknown reading lessons fail closed', () => {
 assert.equal(policyForLesson({ standard: std('CCSS:RL.5.1') }), 'stem_only')
 assert.equal(policyForLesson({ standard: std('CCSS:5.NF.A.1') }), 'free')
 assert.equal(policyForLesson({ subjectName: 'ELA & Social Studies' }), 'stem_only')
 assert.equal(policyForLesson({ subjectName: 'Math & Science' }), 'free')
 assert.equal(policyForLesson({ subjectName: 'Reading' }), 'stem_only')
})

test('open My own work is homework help, never assessed, so it is free', () => {
 assert.equal(policyForLesson({ ownWork: true, subjectName: 'ELA' }), 'free')
})

test('speakable strips markdown and leftover tags', () => {
 assert.equal(speakable('**Great** job! [[NO_TEXT]]'), 'Great job!')
})

test('isAssessedPolicy covers exactly the two reading policies', () => {
 assert.deepEqual(['free', 'stem_only', 'none', 'required'].filter(isAssessedPolicy), ['stem_only', 'none'])
})

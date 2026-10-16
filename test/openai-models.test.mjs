import test from 'node:test'
import assert from 'node:assert/strict'
import { outputText, respond } from '../lib/openai.mjs'
import { modelFor, FALLBACK_MODEL, STRICT_SCHEMA_MODEL, MODELS } from '../lib/models.mjs'

const reply = (status, data) => ({ ok: status >= 200 && status < 300, status, json: async () => data })

test('reads the reply when a reasoning item comes first', () => {
  const data = { output: [{ type: 'reasoning', summary: [] }, { type: 'message', content: [{ type: 'output_text', text: 'Hi! Let’s try fractions with pizza.' }] }] }
  assert.equal(outputText(data), 'Hi! Let’s try fractions with pizza.')
  assert.equal(outputText({ output_text: 'direct' }), 'direct')
  assert.equal(outputText(null), '')
})

test('strict-schema jobs stay on the verified model', () => {
  for (const job of ['lessonPlan', 'lessonSection', 'lessonPacket', 'learningPath', 'parentLetter', 'classLetter']) assert.equal(modelFor(job), STRICT_SCHEMA_MODEL)
  assert.equal(STRICT_SCHEMA_MODEL, FALLBACK_MODEL)
  assert.notEqual(modelFor('vicChat'), FALLBACK_MODEL)
  assert.throws(() => modelFor('nope'))
  assert.ok(Object.keys(MODELS).length >= 12)
})

test('falls back once when the upgraded model is rejected', async (t) => {
  const seen = []
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    const model = JSON.parse(init.body).model
    seen.push(model)
    return model === FALLBACK_MODEL ? reply(200, { output_text: 'ok from fallback' }) : reply(400, { error: { code: 'model_not_found' } })
  })
  t.mock.method(console, 'warn', () => {})
  const { response, data, model } = await respond('vicChat', { input: [] })
  assert.deepEqual(seen, [modelFor('vicChat'), FALLBACK_MODEL])
  assert.equal(response.ok, true)
  assert.equal(model, FALLBACK_MODEL)
  assert.equal(outputText(data), 'ok from fallback')
})

test('falls back when the upgraded model finishes with nothing', async (t) => {
  const seen = []
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    const model = JSON.parse(init.body).model
    seen.push(model)
    return model === FALLBACK_MODEL ? reply(200, { output_text: 'topic' }) : reply(200, { status: 'incomplete', output: [{ type: 'reasoning' }] })
  })
  t.mock.method(console, 'warn', () => {})
  const { data } = await respond('walkthroughTopic', { input: 'x' })
  assert.equal(seen.length, 2)
  assert.equal(outputText(data), 'topic')
})

test('does not retry a server error or a good reply', async (t) => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => { calls++; return reply(500, {}) })
  await respond('vicChat', { input: [] })
  assert.equal(calls, 1)
  calls = 0
  t.mock.method(globalThis, 'fetch', async () => { calls++; return reply(200, { output_text: 'fine' }) })
  await respond('vicChat', { input: [] })
  assert.equal(calls, 1)
})

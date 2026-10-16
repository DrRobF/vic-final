// One way to call the OpenAI Responses API for jobs that are allowed to change models.
//
// Two things this handles that the old inline fetch calls did not:
//
// 1. Reading the reply. Newer models put a reasoning item ahead of the message in `output`,
//    so `output[0].content[0].text` comes back empty. outputText() walks every item.
//
// 2. A safety net. If the upgraded model is rejected (unknown model, unsupported parameter)
//    or finishes with nothing to show, the same request is retried once on FALLBACK_MODEL.
//    A child talking to VIC gets an answer either way, and the logs say which model replied.

import { modelFor, FALLBACK_MODEL } from './models.mjs'

const URL = 'https://api.openai.com/v1/responses'

export function outputText(data) {
  if (typeof data?.output_text === 'string' && data.output_text) return data.output_text
  return (Array.isArray(data?.output) ? data.output : [])
    .flatMap(item => Array.isArray(item?.content) ? item.content : [])
    .filter(part => part?.type === 'output_text' && typeof part.text === 'string')
    .map(part => part.text)
    .join('\n')
}

function shouldFallBack({ response, data }) {
  if (!response.ok) return [400, 404].includes(response.status)
  return !outputText(data) && data?.status === 'incomplete'
}

async function attempt(model, body, signal) {
  const response = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    signal,
    body: JSON.stringify({ ...body, model }),
  })
  const data = await response.json().catch(() => null)
  return { response, data, model }
}

// `job` names a key in MODELS (lib/models.mjs). `body` is the Responses API body without `model`.
export async function respond(job, body, { signal } = {}) {
  const primary = modelFor(job)
  const first = await attempt(primary, body, signal)
  if (primary === FALLBACK_MODEL || !shouldFallBack(first)) return first
  console.warn('OpenAI model fell back', { job, from: primary, to: FALLBACK_MODEL, status: first.response.status, reason: first.data?.error?.code || first.data?.status || '' })
  return attempt(FALLBACK_MODEL, body, signal)
}

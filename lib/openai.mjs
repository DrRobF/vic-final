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

// Busy, overloaded, timed out or dropped: worth trying again rather than showing a child an error.
const RETRYABLE = new Set([0, 408, 409, 429, 500, 502, 503, 504])
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function attempt(model, body, signal, timeoutMs) {
  const signals = [signal, timeoutMs ? AbortSignal.timeout(timeoutMs) : null].filter(Boolean)
  try {
    const response = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      signal: signals.length > 1 ? AbortSignal.any(signals) : signals[0],
      body: JSON.stringify({ ...body, model }),
    })
    const data = await response.json().catch(() => null)
    return { response, data, model }
  } catch (e) {
    // Timeout or network drop: report it as a retryable failure instead of throwing.
    if (signal?.aborted) throw e
    return { response: { ok: false, status: 0 }, data: { error: { code: e?.name === 'TimeoutError' ? 'timeout' : 'network' } }, model }
  }
}

// `job` names a key in MODELS (lib/models.mjs). `body` is the Responses API body without `model`.
// With `budgetMs`, a busy or slow reply is retried: first on FALLBACK_MODEL (a separate rate limit),
// then once more on the primary model if there is still time. Each try gets `timeoutMs`.
export async function respond(job, body, { signal, timeoutMs, budgetMs } = {}) {
  const primary = modelFor(job)
  const started = Date.now()
  const first = await attempt(primary, body, signal, timeoutMs)
  const busy = r => !r.response.ok && RETRYABLE.has(r.response.status)
  if (primary === FALLBACK_MODEL && !(budgetMs && busy(first))) return first
  if (!shouldFallBack(first) && !(budgetMs && busy(first))) return first
  console.warn('OpenAI model fell back', { job, from: primary, to: FALLBACK_MODEL, status: first.response.status, reason: first.data?.error?.code || first.data?.status || '' })
  if (busy(first)) await sleep(400 + Math.random() * 600)
  const second = await attempt(FALLBACK_MODEL, body, signal, timeoutMs)
  if (!budgetMs || !busy(second)) return second
  const left = budgetMs - (Date.now() - started)
  if (left < 8000) return second
  await sleep(800 + Math.random() * 1200)
  console.warn('OpenAI retry on primary', { job, status: second.response.status })
  return attempt(primary, body, signal, Math.min(timeoutMs || left, left - 1000))
}

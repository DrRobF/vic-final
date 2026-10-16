// One place that decides which model does which job.
//
// Before this file, twelve route files each hardcoded 'gpt-4.1-mini', so upgrading meant
// finding every string and hoping none was missed. Now each job names a tier, and every
// tier can be overridden with an environment variable — no deploy needed to change a model.
//
// Tiers, and why a job sits where it does:
//
//   TEACHING  — VIC talking to a child, and the learning report a teacher acts on.
//               Quality matters more than cost here than anywhere else in the product.
//   AUTHORING — building a lesson, worksheet, packet or PD path. Long, structured output.
//   DRAFTING  — letters, messages, meeting prep. A teacher reads and edits every word.
//   UTILITY   — short mechanical extraction. Cheapest tier is fine.
//
// STRICT JSON SCHEMA WARNING
// Jobs that send `text.format.type: 'json_schema'` with `strict: true` are pinned to
// STRICT_SCHEMA_MODEL. As of October 2026 OpenAI documents strict Structured Outputs for
// gpt-6-astra but does not document it for gpt-6.1-sol or gpt-6-luna. Moving a strict job
// to an undocumented model risks breaking generation outright, so those jobs stay on the
// known-good model until someone verifies the replacement against a real request.
// To test one: set OPENAI_STRICT_SCHEMA_MODEL and watch the lesson designer.

const env = (name) => {
  const value = typeof process !== 'undefined' && process.env ? process.env[name] : ''
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

// Current OpenAI lineup: gpt-6-astra (flagship), gpt-6.1-sol (mid), gpt-6-luna (efficient).
export const TEACHING_MODEL = env('OPENAI_TEACHING_MODEL') || 'gpt-6.1-sol'
export const DRAFTING_MODEL = env('OPENAI_DRAFTING_MODEL') || 'gpt-6.1-sol'
export const UTILITY_MODEL = env('OPENAI_UTILITY_MODEL') || 'gpt-6-luna'

// The model everything ran on before October 2026. Every strict-schema job stays here, and any
// upgraded job that errors or comes back empty is retried here once (see lib/openai.mjs).
export const FALLBACK_MODEL = 'gpt-4.1-mini'

// Verified-compatible model for every strict-schema call. Do not change without testing.
export const STRICT_SCHEMA_MODEL = env('OPENAI_STRICT_SCHEMA_MODEL') || FALLBACK_MODEL

export const MODELS = {
  vicChat: TEACHING_MODEL,
  learningReport: TEACHING_MODEL,
  lessonCompanion: DRAFTING_MODEL,
  educatorAssistant: DRAFTING_MODEL,
  assistantPrincipal: DRAFTING_MODEL,
  walkthroughTopic: UTILITY_MODEL,

  // Strict JSON schema — see the warning above before moving any of these.
  lessonPlan: STRICT_SCHEMA_MODEL,
  lessonSection: STRICT_SCHEMA_MODEL,
  lessonPacket: STRICT_SCHEMA_MODEL,
  learningPath: STRICT_SCHEMA_MODEL,
  parentLetter: STRICT_SCHEMA_MODEL,
  classLetter: STRICT_SCHEMA_MODEL,
}

export function modelFor(job) {
  if (!Object.hasOwn(MODELS, job)) throw new Error(`Unknown model job: ${job}`)
  return MODELS[job]
}

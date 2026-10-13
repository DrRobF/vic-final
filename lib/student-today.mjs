import { versionLevel, LEVEL_NAME } from './levels.mjs'

// Assignment modes saved by the VIC roster → the level name teachers use.
const MODE_LEVEL = { remediation: 'remediation', 'on-level': 'core', on_level: 'core', core: 'core', enrichment: 'enrichment' }
export function modeLevel(mode) { return LEVEL_NAME[MODE_LEVEL[mode] || 'core'] }

// The one worksheet version this student should see, with the answers removed.
// Students are only told "Version N", never their level name.
export function studentWorksheet(sheet, mode, groups) {
 const versions = Array.isArray(sheet?.versions) ? sheet.versions : []
 if (!versions.length) return null
 const want = modeLevel(mode)
 let index = versions.findIndex((v, i) => versionLevel(v, i, groups) === want)
 if (index < 0) index = versions.findIndex((v, i) => versionLevel(v, i, groups) === LEVEL_NAME.core)
 if (index < 0) index = 0
 const v = versions[index]
 return {
  index,
  title: String(sheet.title || 'Worksheet'),
  label: versions.length > 1 ? `Version ${index + 1}` : 'Worksheet',
  directions: String(v.directions || ''),
  passage: String(v.passage || ''),
  questions: (v.questions || []).map(q => ({ prompt: String(q?.prompt || '') })),
 }
}

// Cleans a student's answers before saving: one short string per question.
export function cleanAnswers(raw, count) {
 const out = {}
 if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
 for (let i = 0; i < Math.min(count, 20); i++) {
  const value = raw[i] ?? raw[String(i)]
  if (typeof value === 'string' && value.trim()) out[i] = value.slice(0, 4000)
 }
 return out
}

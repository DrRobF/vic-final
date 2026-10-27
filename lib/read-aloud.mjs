// Deciding what VIC may say out loud to one child, for one reply.
//
// The rule (see lib/learner-profile.mjs): support everything except the thing being measured.
// A spoken math word problem removes a barrier that is not the point. A spoken reading passage
// removes the point. So the decision is made per reply, from two facts: what the child has
// switched on, and what the skill being taught actually measures.
//
// The hard part is telling the passage apart from VIC's own teaching inside one chat message.
// So for the skills where it matters (reading and decoding), VIC is asked to wrap the text the
// child must read in [[TEXT]] ... [[/TEXT]]. Everything outside the tags is teaching and may be
// spoken. If VIC neither tags a passage nor says there is none, we cannot tell, so nothing is
// spoken: a message left silent is a small loss, and reading the passage to a child who is being
// assessed on reading quietly ruins the evidence.
//
// Everything here is gated on the child actually using read-aloud or a language, so a child on
// the defaults sees no change at all.
import { supportFor, DEFAULT_SUPPORTS } from './learner-profile.mjs'

const TEXT_BLOCK = /\[\[\s*TEXT\s*\]\]([\s\S]*?)\[\[\s*\/\s*TEXT\s*\]\]/gi
const STRAY = /\[\[\s*\/?\s*(TEXT|NO_TEXT)\s*\]\]/gi
const NO_TEXT = /\[\[\s*NO_TEXT\s*\]\]/i

// The skills where the words on the page ARE what is being judged.
export const isAssessedPolicy = p => p === 'stem_only' || p === 'none'

/**
 * Which audio policy applies to this lesson.
 * A practice skill carries its standard, so we know exactly. A teacher's own lesson might not;
 * math is safe to read aloud, and anything else is treated as reading, because guessing "free"
 * for a reading lesson is the mistake that costs something. Open "My own work" is homework help,
 * never assessed, so it is free.
 */
export function policyForLesson({ standard = null, subjectName = '', ownWork = false } = {}) {
 if (standard?.audio) return standard.audio
 if (ownWork) return 'free'
 if (/math/i.test(subjectName || '')) return 'free'
 return 'stem_only'
}

const LANGUAGE_NAME = { es: 'Spanish', ht: 'Haitian Creole (Kreyòl ayisyen)' }

/**
 * Extra instructions for this session's context. Empty for a child on the defaults, so nothing
 * changes for anyone who has not been given these supports.
 */
export function sessionInstructions({ policy, translate = 'scaffold_only', supports = DEFAULT_SUPPORTS } = {}) {
 const s = { ...DEFAULT_SUPPORTS, ...(supports || {}) }
 if (s.read_aloud === 'off' && s.language === 'en') return ''
 const parts = []
 if (isAssessedPolicy(policy)) {
  parts.push([
   'THE CHILD MUST READ THIS SKILL THEMSELVES. This skill is about reading, and this child may have your messages read aloud.',
   'Whenever your message contains a passage, sentence, or words that the child is meant to read and be judged on, put exactly that text between [[TEXT]] and [[/TEXT]].',
   'Keep everything else (directions, questions, teaching, hints, encouragement) outside the tags. Do not repeat the passage outside the tags, and do not paraphrase it for them.',
   'If your message contains no text for the child to read, end it with [[NO_TEXT]]. Use these tags and nothing else like them. The child never sees them.',
  ].join(' '))
 }
 if (s.language !== 'en' && LANGUAGE_NAME[s.language]) {
  const name = LANGUAGE_NAME[s.language]
  parts.push([
   `LANGUAGE. This child learns best in ${name}.`,
   translate === 'free'
    ? `Write your whole reply in ${name}, in clear, simple words a child understands. Keep numbers and math symbols as they are.`
    : `Write your teaching, directions, questions and encouragement in ${name}, in clear, simple words a child understands. The English text the lesson is about stays in English (inside the [[TEXT]] tags when you use them): explain around it, do not translate it.`,
   'If the child writes to you in English, you may answer in English for that message.',
  ].join(' '))
 }
 return parts.join('\n\n')
}

/**
 * Split a reply into the passage the child must read and everything else, removing the tags.
 * An opening tag that never closes runs to the end of the message: when unsure, it is the
 * passage, because the cost of wrongly calling teaching "passage" is silence and the cost of the
 * opposite is a ruined measurement.
 */
export function splitText(reply) {
 let text = String(reply || '')
 const noText = NO_TEXT.test(text)
 const opens = (text.match(/\[\[\s*TEXT\s*\]\]/gi) || []).length
 const closes = (text.match(/\[\[\s*\/\s*TEXT\s*\]\]/gi) || []).length
 if (opens > closes) text += '[[/TEXT]]'
 const segments = []
 let last = 0, tagged = false
 for (const m of text.matchAll(TEXT_BLOCK)) {
  tagged = true
  if (m.index > last) segments.push({ text: text.slice(last, m.index), assessed: false })
  segments.push({ text: m[1], assessed: true })
  last = m.index + m[0].length
 }
 if (last < text.length) segments.push({ text: text.slice(last), assessed: false })
 const clean = s => s.replace(STRAY, '')
 const kept = segments.map(s => ({ ...s, text: clean(s.text) })).filter(s => s.text.trim())
 return {
  text: kept.map(s => s.text).join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(),
  segments: kept,
  tagged,
  noText,
 }
}

// What a speech engine should be given: no markdown stars, no leftover tags, one tidy line.
export function speakable(text) {
 return String(text || '').replace(STRAY, '').replace(/\*\*|__/g, '').replace(/^[\s>*-]+/gm, '').replace(/\s+/g, ' ').trim()
}

/**
 * The plan for one reply: may it be spoken, in what language, and which parts.
 * Returns null when this child does not use read-aloud or a language, so callers can leave the
 * response exactly as it was.
 */
export function buildSpeech({ marked, policy, translate = 'scaffold_only', supports = DEFAULT_SUPPORTS } = {}) {
 const s = { ...DEFAULT_SUPPORTS, ...(supports || {}) }
 if (s.read_aloud === 'off' && s.language === 'en') return null
 const sup = supportFor({ audio: policy, translate }, s)
 const base = { language: sup.language, policy }

 // For reading and decoding we must know where the passage is, or we cannot know what to hold back.
 if (isAssessedPolicy(policy) && !marked.tagged && !marked.noText) return { ...base, available: false, reason: 'unmarked' }
 if (!sup.speakScaffold && !sup.speakAssessed) return { ...base, available: false, reason: 'off' }

 const spoken = marked.segments.filter(seg => (seg.assessed ? sup.speakAssessed : sup.speakScaffold))
 const heldBack = marked.segments.some(seg => seg.assessed && !sup.speakAssessed)
 const text = spoken.map(seg => speakable(seg.text)).filter(Boolean).join('\n\n')
 if (!text) return { ...base, available: false, reason: heldBack ? 'passage-only' : 'empty', heldBack }
 return { ...base, available: true, auto: sup.autoSpeak, text, heldBack }
}

// Read-aloud, using the voice already built into the browser. No API, no account, no cost.
// Every piece of text a child has to read gets a speaker button: if the content is gated
// behind reading, the weakest readers get the least content, which is backwards.
// Free voices are flat and will mispronounce things. That is fine for a read-aloud button.

import { pickVoiceFor } from './voice-pick.mjs'

let warmed = false

export function speechReady() {
 return typeof window !== 'undefined' && 'speechSynthesis' in window
}

// Chrome loads its voice list asynchronously and reports an empty list on first ask.
function pickVoice(language = 'en') {
 try { return pickVoiceFor(window.speechSynthesis.getVoices() || [], language) } catch { return null }
}

// Can this browser say this language at all? The screen uses it to hide the speaker button
// rather than show one that does nothing. English is always attempted; Spanish and Haitian
// Creole need an installed voice that matches.
export function canSpeak(language = 'en') {
 if (!speechReady()) return false
 return language === 'en' ? true : pickVoice(language) !== null
}

export function warmVoices() {
 if (warmed || !speechReady()) return
 warmed = true
 try {
  window.speechSynthesis.getVoices()
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {}, { once: true })
 } catch {}
}

// Speak some text. Returns true if it started. Cancels anything already speaking,
// so tapping a second speaker button never leaves two voices talking over each other.
export function speak(text, { onEnd, language = 'en' } = {}) {
 const words = String(text || '').trim()
 if (!words || !speechReady()) return false
 try {
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(words)
  const v = pickVoice(language)
  // No matching voice for a non-English language: say nothing rather than mispronounce it.
  if (!v && language !== 'en') { onEnd?.(); return false }
  if (v) { u.voice = v; u.lang = v.lang }
  u.rate = 0.95       // a touch slower than default; these are 8-to-11-year-olds
  u.pitch = 1
  u.onend = () => onEnd?.()
  u.onerror = () => onEnd?.()
  window.speechSynthesis.speak(u)
  return true
 } catch { onEnd?.(); return false }
}

export function stopSpeaking() {
 if (!speechReady()) return
 try { window.speechSynthesis.cancel() } catch {}
}

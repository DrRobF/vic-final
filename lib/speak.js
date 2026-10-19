// Read-aloud, using the voice already built into the browser. No API, no account, no cost.
// Every piece of text a child has to read gets a speaker button: if the content is gated
// behind reading, the weakest readers get the least content, which is backwards.
// Free voices are flat and will mispronounce things. That is fine for a read-aloud button.

let warmed = false

export function speechReady() {
 return typeof window !== 'undefined' && 'speechSynthesis' in window
}

// Chrome loads its voice list asynchronously and reports an empty list on first ask.
function pickVoice() {
 try {
  const all = window.speechSynthesis.getVoices() || []
  if (!all.length) return null
  const en = all.filter(v => /^en(-|_|$)/i.test(v.lang || ''))
  const pool = en.length ? en : all
  return pool.find(v => v.localService) || pool[0]
 } catch { return null }
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
export function speak(text, { onEnd } = {}) {
 const words = String(text || '').trim()
 if (!words || !speechReady()) return false
 try {
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(words)
  const v = pickVoice()
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

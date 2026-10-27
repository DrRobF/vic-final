// Choosing a browser voice for a language. Pure, so it can be tested without a browser.
//
// The rule that matters: a voice must MATCH the language or there is no voice. Reading Spanish
// with an English voice is gibberish to a child, and reading Haitian Creole with a French voice
// is worse -- it sounds almost right and teaches wrong sounds. So when nothing matches we say
// "no voice" and let the screen hide the button, rather than fall back to whatever is installed.
// (English keeps its old forgiving behaviour: any voice beats silence for a read-aloud button.)

// Which BCP-47 prefixes count as a match for each language AskVic supports.
// Haitian Creole is `ht`; no mainstream browser ships a voice for it today, so this will
// normally find nothing -- which is the honest answer.
const MATCH = { en: /^en(-|_|$)/i, es: /^es(-|_|$)/i, ht: /^ht(-|_|$)/i }

// For Spanish, a child in Florida is best served by US Spanish, then Latin American, then any.
const PREFER = { es: [/^es[-_]US$/i, /^es[-_]MX$/i, /^es[-_]419$/i] }

export function pickVoiceFor(voices, language = 'en') {
 const all = Array.isArray(voices) ? voices : []
 if (!all.length) return null
 const match = MATCH[language] || MATCH.en
 const pool = all.filter(v => match.test(v.lang || ''))
 if (!pool.length) return language === 'en' ? (all.find(v => v.localService) || all[0]) : null
 for (const re of PREFER[language] || []) {
  const same = pool.filter(v => re.test(v.lang || ''))
  if (same.length) return same.find(v => v.localService) || same[0]
 }
 return pool.find(v => v.localService) || pool[0]
}

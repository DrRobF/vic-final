import { useEffect, useRef, useState } from 'react'
import { speak, stopSpeaking, canSpeak, warmVoices } from '../lib/speak'

// The speaker button under one of VIC's messages.
//
// The server has already decided what may be spoken (lib/read-aloud.mjs): `speech.text` is only
// the parts that are safe to say, with any passage the child is being assessed on reading left
// out. This component only plays it. It never decides what to say.
//
// Large and labelled in words, not colour, because the children who need it most are often the
// weakest readers and some of them cannot rely on telling shades apart.
const LANGUAGE_WORD = { es: 'Spanish', ht: 'Haitian Creole' }

export default function SpeakButton({ speech, auto = false, onSpoke }) {
 const language = speech?.language || 'en'
 const [ready, setReady] = useState(false)
 const [speaking, setSpeaking] = useState(false)
 const mounted = useRef(true)
 const started = useRef(false)

 // Browsers load their voice list a moment after the page does.
 useEffect(() => {
  mounted.current = true
  warmVoices()
  const check = () => { if (mounted.current) setReady(canSpeak(language)) }
  check()
  let target = null
  try { target = window.speechSynthesis; target?.addEventListener?.('voiceschanged', check) } catch {}
  return () => {
   mounted.current = false
   try { target?.removeEventListener?.('voiceschanged', check) } catch {}
   if (started.current) stopSpeaking()
  }
 }, [language])

 function play() {
  if (!speech?.text) return
  started.current = true
  setSpeaking(true)
  const ok = speak(speech.text, { language, onEnd: () => { if (mounted.current) setSpeaking(false) } })
  if (!ok) setSpeaking(false)
  // The attempt record needs to know VIC actually spoke: a child can have the button all
  // period and never press it, and a 'met' heard aloud is a different fact from one read cold.
  else onSpoke?.()
 }
 function toggle() {
  if (speaking) { stopSpeaking(); setSpeaking(false) } else play()
 }

 // A child set to "always" hears VIC without having to tap. If the browser refuses (it may
 // want a tap first), the button is still there.
 useEffect(() => {
  if (!auto || !speech?.auto || !ready || started.current) return
  const t = setTimeout(() => { if (mounted.current && !started.current) play() }, 250)
  return () => clearTimeout(t)
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [auto, ready])

 if (!speech) return null
 const note = speech.heldBack ? 'VIC reads the directions. The part to read is for you to read yourself.' : ''
 const noVoice = speech.available && !ready && language !== 'en' && !!LANGUAGE_WORD[language]

 return (
  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
   {speech.available && ready ? (
    <button
     type="button"
     onClick={toggle}
     aria-pressed={speaking}
     style={{ minHeight: 48, padding: '8px 18px', borderRadius: 12, border: '2px solid #4E5B78', background: speaking ? '#EEF2FA' : '#fff', color: '#1F2A44', fontSize: 17, fontWeight: 700, cursor: 'pointer' }}
    >
     {speaking ? '⏹ Stop' : '🔊 Listen'}
    </button>
   ) : null}
   {noVoice ? <span style={{ fontSize: 14, color: '#4E5B78' }}>This computer has no {LANGUAGE_WORD[language]} voice, so VIC can’t read this one out loud.</span> : null}
   {speech.available && note ? <span style={{ fontSize: 14, color: '#4E5B78' }}>{note}</span> : null}
  </div>
 )
}

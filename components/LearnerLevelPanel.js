import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// Where a teacher says "this child is working at a different level than their grade".
// Opens from the student's row on the class screen. Two subjects, one choice each, and for a
// school leader one more switch (alternate standards, set from the child's IEP).
//
// Deliberately small. Every switch here does something: the working level changes what VIC
// picks for practice, and read-aloud and language change how VIC talks to the child.

const LEVEL_OPTIONS = [['', 'Same as their grade'], [0, 'Kindergarten'], ...Array.from({ length: 12 }, (_, i) => [i + 1, `Grade ${i + 1}`])]
const SUBJECTS = [['reading', 'Reading'], ['math', 'Math']]
const READ_ALOUD = [['off', 'Off'], ['on_request', 'A Listen button the child taps'], ['always', 'VIC reads aloud on its own']]
const LANGUAGES = [['en', 'English'], ['es', 'Spanish'], ['ht', 'Haitian Creole (written only)']]

export default function LearnerLevelPanel({ student, onClose }) {
 const [data, setData] = useState(null)
 const [levels, setLevels] = useState({ reading: '', math: '' })
 const [alt, setAlt] = useState(false)
 const [readAloud, setReadAloud] = useState('off')
 const [language, setLanguage] = useState('en')
 const [state, setState] = useState('loading') // loading | ready | saving | saved | error
 const [error, setError] = useState('')
 const closeRef = useRef(null)

 // Same way the rest of the class screen signs its requests.
 async function token() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || ''
 }

 useEffect(() => {
  let live = true
  ;(async () => {
   try {
    const r = await fetch(`/api/teacher/learner-settings?studentId=${student.id}`, { headers: { Authorization: `Bearer ${await token()}` } })
    const d = await r.json().catch(() => ({}))
    if (!live) return
    if (!r.ok) { setError(d.error || 'Could not load.'); setState('error'); return }
    setData(d)
    setLevels({ reading: d.levels.reading?.level ?? '', math: d.levels.math?.level ?? '' })
    setAlt(!!d.supports.alternate_standards)
    setReadAloud(d.supports.read_aloud || 'off')
    setLanguage(d.supports.language || 'en')
    setState('ready')
   } catch { if (live) { setError('Could not load.'); setState('error') } }
  })()
  return () => { live = false }
 }, [student.id])

 useEffect(() => { closeRef.current?.focus() }, [])
 useEffect(() => {
  const onKey = e => { if (e.key === 'Escape') onClose() }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
 }, [onClose])

 async function save() {
  setState('saving'); setError('')
  // Send only what changed, so saving one subject never touches the other.
  const body = { studentId: student.id, levels: {}, supports: {} }
  for (const [key] of SUBJECTS) {
   const was = data.levels[key]?.level ?? ''
   if (String(levels[key]) !== String(was)) body.levels[key] = levels[key] === '' ? null : Number(levels[key])
  }
  if (data.can.alternateStandards && alt !== !!data.supports.alternate_standards) body.supports.alternate_standards = alt
  if (data.can.readAloud && readAloud !== (data.supports.read_aloud || 'off')) body.supports.read_aloud = readAloud
  if (data.can.language && language !== (data.supports.language || 'en')) body.supports.language = language
  if (!Object.keys(body.levels).length && !Object.keys(body.supports).length) { setState('saved'); return }
  try {
   const r = await fetch('/api/teacher/learner-settings', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify(body) })
   const d = await r.json().catch(() => ({}))
   if (!r.ok) { setError(d.error || 'Could not save.'); setState('error'); return }
   setData(d)
   setLevels({ reading: d.levels.reading?.level ?? '', math: d.levels.math?.level ?? '' })
   setAlt(!!d.supports.alternate_standards)
   setReadAloud(d.supports.read_aloud || 'off')
   setLanguage(d.supports.language || 'en')
   setState('saved')
  } catch { setError('Could not save.'); setState('error') }
 }

 const grade = data?.student.enrolledGrade
 const enrolled = grade == null ? 'No grade set' : grade === 0 ? 'Kindergarten' : `Grade ${grade}`
 const busy = state === 'loading' || state === 'saving'

 return (
  <div className="scrim" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
   <section className="panel" role="dialog" aria-modal="true" aria-labelledby="lvl-title">
    <header>
     <div>
      <h2 id="lvl-title">How VIC teaches {student.name || 'this student'}</h2>
      <p className="muted">{data ? `Enrolled in ${enrolled}. Their place on the roster does not change.` : 'Loading…'}</p>
     </div>
     <button type="button" ref={closeRef} className="x" onClick={onClose} aria-label="Close">Close</button>
    </header>

    {state === 'error' && !data ? <p className="msg" role="alert">{error}</p> : data && <>
     <p className="lead">Pick the grade VIC should teach from. It works in both directions: lower for a child who needs to build up, higher for a child who is ready for more.</p>
     {SUBJECTS.map(([key, label]) => (
      <label key={key} className="row">
       <span>{label}</span>
       <select value={levels[key]} disabled={busy} onChange={e => { setLevels(l => ({ ...l, [key]: e.target.value })); setState('ready') }}>
        {LEVEL_OPTIONS.map(([v, text]) => <option key={String(v)} value={v}>{text}</option>)}
       </select>
      </label>
     ))}
     <p className="hint">This changes the practice VIC picks for them. Lessons you assign yourself stay as you planned them.</p>

     {data.can.readAloud ? <>
      <label className="row">
       <span>Read aloud</span>
       <select value={readAloud} disabled={busy} onChange={e => { setReadAloud(e.target.value); setState('ready') }}>
        {READ_ALOUD.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
       </select>
      </label>
      <label className="row">
       <span>VIC talks in</span>
       <select value={language} disabled={busy} onChange={e => { setLanguage(e.target.value); setState('ready') }}>
        {LANGUAGES.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
       </select>
      </label>
      <p className="hint">VIC never reads out the passage or words a child is being assessed on reading. It reads the directions and questions, and tells the child which part is theirs to read. Spanish and Haitian Creole change the language VIC explains in; the English text a lesson is about stays in English. Haitian Creole is written only, because most computers have no Creole voice.</p>
     </> : null}

     {data.can.alternateStandards
      ? <label className="check"><input type="checkbox" checked={alt} disabled={busy} onChange={e => { setAlt(e.target.checked); setState('ready') }} />
        <span><strong>Teach from alternate standards (Access Points)</strong><br /><small>Only for a student whose IEP team calls for it. Never because of low scores.</small></span></label>
      : <p className="hint">{data.supports.alternate_standards ? 'This student is on alternate standards. ' : ''}{data.help}</p>}

     <footer>
      <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>{state === 'saving' ? 'Saving…' : 'Save'}</button>
      {state === 'saved' && <span className="ok" role="status">Saved ✓</span>}
      {state === 'error' && <span className="msg" role="alert">{error}</span>}
     </footer>
    </>}
   </section>
   <style jsx>{`
    .scrim{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px;z-index:50}
    .panel{background:var(--vic-surface,#fff);color:var(--vic-text-primary,#111);border-radius:16px;padding:20px;width:min(520px,100%);max-height:90vh;overflow:auto;display:flex;flex-direction:column;gap:12px}
    header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
    h2{margin:0;font-size:20px}
    .muted,.hint{margin:0;color:var(--vic-text-secondary,#555);font-size:14px;line-height:1.4}
    .lead{margin:0;line-height:1.45}
    .row{display:flex;justify-content:space-between;align-items:center;gap:12px;font-weight:700}
    select{min-height:44px;min-width:200px;border-radius:10px;padding:0 10px;font:inherit;font-weight:400}
    .check{display:flex;gap:10px;align-items:flex-start;line-height:1.4}
    .check input{width:22px;height:22px;margin-top:2px}
    footer{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:4px}
    .x{min-height:36px;padding:4px 12px;border-radius:10px;border:1px solid var(--vic-border,#ccc);background:none;font:inherit;cursor:pointer}
    .ok{font-weight:800}
    .msg{color:var(--vic-danger,#b00020);font-weight:700;margin:0}
   `}</style>
  </div>
 )
}

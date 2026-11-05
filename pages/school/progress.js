import { useCallback, useEffect, useState } from 'react'
import PageShell, { PanelStyles } from '../../components/PageShell'
import { supabase } from '../../lib/supabase'

// What VIC's rows say about children, at whichever altitude you arrived from. A leader sees
// standards first and children underneath; a teacher sees their own children by name. Same
// page, because it is the same question, and two pages drift apart.
//
// Two rules this screen obeys and will keep obeying:
//
// 1. It never says "on level", and nothing here is a grade. `met` means VIC judged three
//    correct unaided in one sitting -- acquisition, not mastery, and nobody knows whether it
//    survived a fortnight. The honest version needs a second reading two or more weeks later
//    (assessment-and-privacy-spec.md). Until that exists this screen reports what was
//    attempted and what landed, and lets the adult draw the conclusion.
// 2. The two signals are never merged into one "red flag" list. A child opening skills and
//    leaving is the adult in the room; a child working hard and getting nowhere is the
//    teacher. One list sends you to the wrong person half the time.
//
// Colour never carries meaning on its own: blue and orange, each with a symbol and a word,
// because red and green are not a pair everyone can read.

async function api(path) {
 const { data: { session } } = await supabase.auth.getSession()
 if (!session) { window.location.replace('/login?next=/school/progress'); throw new Error('Please sign in.') }
 const r = await fetch(path, { headers: { Authorization: `Bearer ${session.access_token}` } })
 const d = await r.json().catch(() => ({}))
 if (!r.ok) throw new Error(d.error || 'Could not load student progress.')
 return d
}

const WINDOWS = [[7, 'This week'], [14, 'Two weeks'], [30, 'This month']]
const effortWord = turns => (turns >= 30 ? 'a long time' : turns >= 20 ? 'a good while' : 'real time')

export default function Progress() {
 const [data, setData] = useState(null), [error, setError] = useState(''), [days, setDays] = useState(14)
 const [schoolId, setSchoolId] = useState(null), [loading, setLoading] = useState(true)

 // Find the school first; a teacher with no school simply gets the classes view.
 useEffect(() => {
  api('/api/assistantprincipal/lessonplans')
   .then(d => setSchoolId(d.schools?.[0]?.id || ''))
   .catch(() => setSchoolId(''))
 }, [])

 const load = useCallback(() => {
  if (schoolId === null) return
  setLoading(true)
  const q = `days=${days}${schoolId ? `&schoolId=${encodeURIComponent(schoolId)}` : ''}`
  api(`/api/school/progress?${q}`).then(d => { setData(d); setError('') }).catch(e => setError(e.message)).finally(() => setLoading(false))
 }, [schoolId, days])
 useEffect(() => { load() }, [load])

 const isSchool = data?.scope?.kind === 'school'
 const className = id => data?.scope?.classes?.find(c => c.id === id)?.name || ''
 const who = id => data?.students?.[id]?.name || 'A student'

 return <PageShell title="Student progress" currentPath="/school/progress">
  <PanelStyles />
  <header className="top">
   <div>
    <h1>What VIC is seeing</h1>
    <p className="muted">
     {isSchool ? 'Across your school. Standards first — children are underneath each one.' : 'Your classes.'}
     {data ? ` · ${data.counted} ${data.counted === 1 ? 'session' : 'sessions'} in the last ${data.windowDays} days.` : ''}
    </p>
   </div>
   <div className="windows" role="group" aria-label="Time window">
    {WINDOWS.map(([n, label]) =>
     <button key={n} type="button" className={`btn btn-outline sm ${days === n ? 'on' : ''}`} aria-pressed={days === n} onClick={() => setDays(n)}>{label}</button>)}
   </div>
  </header>

  {error && <p className="alert" role="alert">{error}</p>}
  {loading && !data ? <p role="status">Reading what VIC recorded…</p> : data && <>

   {data.empty === 'no-classes' &&
    <section className="panel"><h2>No classes yet</h2><p>Once a class has children in it and they work with VIC, what they did shows up here.</p></section>}

   {/* The principal's altitude. A standard is something you can send help to; a child is not. */}
   {isSchool && !!data.standards.length &&
    <section className="panel" aria-label="Standards this period">
     <h2>Standards this period</h2>
     <p>Where the teaching is not landing, hardest first. This is the list to walk into a classroom about.</p>
     <ul className="stds">
      {data.standards.slice(0, 12).map(s =>
       <li key={s.standardId} className={s.notLanded > s.landed ? 'hard' : ''}>
        <span className="mark" aria-hidden="true">{s.notLanded > s.landed ? '◆' : '◇'}</span>
        <span className="body">
         <b>{s.standard.code}</b>
         {s.standard.text && <em>{s.standard.text}</em>}
         <span className="line">{s.line}</span>
        </span>
        <span className="tallies">
         <span className="t landed"><b>{s.landed}</b> got there</span>
         <span className="t not"><b>{s.notLanded}</b> did not</span>
         {!!s.started && <span className="t started"><b>{s.started}</b> only started</span>}
        </span>
       </li>)}
     </ul>
    </section>}

   {/* Signal 1 — a teaching question. */}
   <section className="panel" aria-label="Worked at it and it has not landed">
    <h2><span className="sym worked" aria-hidden="true">◆</span> Worked at it, hasn’t landed</h2>
    <p>These children stayed and put the time in, and it still is not there. This is a teaching question — a different explanation, or a closer look.</p>
    {!data.struggling.length
     ? <p className="calm">Nobody is stuck on anything right now.</p>
     : <ul className="finds">
      {data.struggling.map(s =>
       <li key={`${s.studentId}|${s.standardId}`}>
        <span className="name">{who(s.studentId)}</span>
        <span className="detail">
         <b>{s.standard.code}</b>{s.standard.text ? ` — ${s.standard.text}` : ''}
         <span className="sub">
          {s.repeated ? `Came back to it ${s.tries} times` : `Spent ${effortWord(s.turns)} on it`}
          {s.toldNotYet ? ' · VIC said not yet' : ''}
          {s.audioOnAssessed ? ' · read aloud was on' : ''}
          {s.alternateStandard ? ' · access points' : ''}
          {isSchool && className(s.classId) ? ` · ${className(s.classId)}` : ''}
         </span>
        </span>
        {s.repeated && <span className="tag" title="Every child who came back to a standard a second time in the first week ended without getting there.">Came back</span>}
       </li>)}
     </ul>}
   </section>

   {/* Signal 2 — a supervision question. Kept apart on purpose. */}
   <section className="panel" aria-label="Opening skills and leaving">
    <h2><span className="sym browsed" aria-hidden="true">○</span> Opening skills and leaving</h2>
    <p>These children started things and did not stay. That is usually the room rather than the work — a login, a bell, somewhere else to be. Worth a word with whoever is supervising, not a change of lesson.</p>
    {!data.disengaged.length
     ? <p className="calm">Everyone who started something stayed with it.</p>
     : <ul className="finds">
      {data.disengaged.map(d =>
       <li key={d.studentId}>
        <span className="name">{who(d.studentId)}</span>
        <span className="detail">
         Opened {d.browsed} {d.browsed === 1 ? 'skill' : 'skills'} and left
         <span className="sub">{d.worked ? `Also worked properly on ${d.worked} ${d.worked === 1 ? 'thing' : 'things'}` : 'Nothing worked through this period'}{isSchool && className(d.classId) ? ` · ${className(d.classId)}` : ''}</span>
        </span>
       </li>)}
     </ul>}
   </section>

   <p className="muted small foot">
    “Got there” means VIC saw three correct in a row, unaided, in one sitting. It does not yet mean a child has kept it —
    that needs a second look a fortnight later, which AskVic does not record yet. Nothing on this page is a grade.
   </p>
  </>}

  <style jsx>{`
   .top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}
   h1{margin:0 0 4px;font-size:28px}
   .windows{display:flex;gap:8px;flex-wrap:wrap}
   :global(.btn.sm){min-height:36px;padding:7px 13px;font-size:14px}
   :global(.btn-outline.on){border-color:var(--vic-primary);color:var(--vic-primary);background:var(--vic-primary-soft,rgba(37,99,235,.08))}
   .calm{font-weight:700;color:var(--vic-text-secondary);margin-top:12px}
   .sym{display:inline-block;margin-right:8px}
   .sym.worked{color:var(--vic-primary)}
   .sym.browsed{color:var(--vic-warning,#B45309)}
   ul{list-style:none;margin:14px 0 0;padding:0;display:flex;flex-direction:column;gap:10px}
   .stds li,.finds li{display:flex;gap:12px;align-items:flex-start;padding:13px 15px;border:1px solid var(--vic-border-soft);border-radius:12px;background:var(--vic-surface-muted)}
   .stds li.hard{border-color:var(--vic-primary);border-left-width:4px}
   .stds .mark{color:var(--vic-primary);font-size:15px;line-height:1.6}
   .stds .body{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0}
   .stds .body em{font-style:normal;color:var(--vic-text-secondary);font-size:14px}
   .stds .line{font-size:14px;font-weight:700;margin-top:3px}
   .tallies{display:flex;flex-direction:column;gap:3px;text-align:right;font-size:13px;white-space:nowrap}
   .t b{font-size:15px}
   .t.landed{color:var(--vic-text-secondary)}
   .t.not{color:var(--vic-primary);font-weight:700}
   .t.started{color:var(--vic-text-secondary)}
   .finds .name{font-weight:800;min-width:120px}
   .finds .detail{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0;font-size:15px}
   .finds .sub{color:var(--vic-text-secondary);font-size:13px}
   .tag{font-size:12px;font-weight:800;padding:4px 9px;border-radius:999px;background:var(--vic-primary);color:#fff;white-space:nowrap}
   .foot{font-size:13px;line-height:1.6;max-width:70ch}
   @media(max-width:640px){
    .stds li,.finds li{flex-direction:column;gap:6px}
    .tallies{flex-direction:row;gap:12px;text-align:left}
    .finds .name{min-width:0}
   }
  `}</style>
 </PageShell>
}

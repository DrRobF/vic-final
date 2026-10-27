import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import PageShell, { PanelStyles } from '../components/PageShell'
import { supabase } from '../lib/supabase'
import { pictureFor } from '../lib/room-pictures.mjs'

async function api(path, body) {
 const { data: { session } } = await supabase.auth.getSession()
 if (!session) { window.location.replace('/login?next=/room'); throw new Error('Please log in.') }
 const r = await fetch(path, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
 const d = await r.json().catch(() => ({}))
 if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again.')
 return d
}
const STATUS = {
 alert: { icon: '⚠', word: 'Needs you', cls: 'alert' },
 quiet: { icon: '⏸', word: 'Quiet', cls: 'quiet' },
 out: { icon: '○', word: 'Not logged in', cls: 'out' },
 working: { icon: '✓', word: 'Working', cls: 'working' },
}
const ORDER = { alert: 0, quiet: 1, out: 2, working: 3 }
const Pics = ({ keys }) => keys ? <span className="pics">{keys.map((k, i) => <span key={i} title={pictureFor(k)?.label}>{pictureFor(k)?.emoji}</span>)}</span> : <span className="muted">No pictures yet</span>

// VIC Room: the screen for the adult in a room where students learn with VIC.
// Who's working, who's quiet, who needs help; launch today's lessons; logins and picture cards.
export default function Room() {
 const router = useRouter()
 const [list, setList] = useState(null), [room, setRoom] = useState(null), [error, setError] = useState(''), [tab, setTab] = useState('live')
 const [open, setOpen] = useState(null), [msg, setMsg] = useState(''), [editing, setEditing] = useState(false)
 const id = typeof router.query.id === 'string' ? router.query.id : list?.rooms?.[0]?.id || ''
 const timer = useRef(null)

 useEffect(() => { api('/api/room/manage').then(setList).catch(e => setError(e.message)) }, [])
 async function refresh() { if (!id) return; try { setRoom(await api(`/api/room/manage?id=${encodeURIComponent(id)}`)) } catch (e) { setError(e.message) } }
 useEffect(() => {
  if (!id) return
  refresh()
  clearInterval(timer.current)
  timer.current = setInterval(() => { if (document.visibilityState === 'visible') refresh() }, 15000)
  return () => clearInterval(timer.current)
 }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

 async function act(body, done) {
  setMsg('')
  try { const d = await api('/api/room/manage', { roomId: id, ...body }); if (done) setMsg(done(d)); await refresh() } catch (e) { setMsg(e.message) }
 }

 const student = room?.students?.find(s => s.id === open)
 const sorted = [...(room?.students || [])].sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name))

 return <PageShell title={room ? `VIC Room · ${room.name}` : 'VIC Room'} currentPath="/room">
  <PanelStyles />
  {error && <p className="alert" role="alert">{error}</p>}
  {!list ? <p role="status">Opening the VIC Room…</p>
   : (!list.rooms.length || editing) ? <RoomSetup list={list} room={editing ? room : null} onDone={async rid => { setEditing(false); const l = await api('/api/room/manage'); setList(l); router.replace(`/room?id=${rid}`) }} onCancel={editing ? () => setEditing(false) : null} />
   : !room ? <p role="status">Opening your room…</p>
   : <>
    <header className="top">
     <div>
      <p className="label">VIC Room{list.rooms.length > 1 ? '' : ''}</p>
      <h1>{room.name}</h1>
      <p className="muted">Room code <strong className="code">{room.code}</strong> · students log in at <strong>askvic.ai/hello</strong></p>
     </div>
     <div className="row">
      {list.rooms.length > 1 && <select aria-label="Choose a room" value={id} onChange={e => router.replace(`/room?id=${e.target.value}`)}>{list.rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>}
      <button type="button" className="btn btn-outline" onClick={() => setEditing(true)}>Edit room</button>
     </div>
    </header>
    <nav className="tabs" aria-label="Room views">
     <button type="button" className={tab === 'live' ? 'on' : ''} onClick={() => setTab('live')}>Live</button>
     <button type="button" className={tab === 'logins' ? 'on' : ''} onClick={() => setTab('logins')}>Logins and picture cards</button>
    </nav>
    {msg && <p className="notice" role="status">{msg}</p>}

    {tab === 'live' ? <>
     <div className="summary">
      {['alert', 'quiet', 'out', 'working'].map(k => <span key={k} className={`pill ${STATUS[k].cls}`}><b>{STATUS[k].icon} {room.summary[k]}</b> {STATUS[k].word}</span>)}
      <span className="muted">of {room.summary.total} · updates every 15 seconds</span>
     </div>

     <section className="panel launch">
      <p className="label">Today’s lessons</p>
      {room.launchable?.length > 0
       ? room.launchable.map(l => <div key={l.lessonId + l.classId} className="lrow">
         <div><strong>{l.title}</strong><span className="muted"> · {l.className}{l.teacher ? ` · ${l.teacher}` : ''}</span></div>
         {l.live ? <span className="ok">✓ On screens</span> : !l.ready ? <span className="warn">Needs a standard and objective (ask {l.teacher || 'the teacher'})</span>
          : <button type="button" className="btn btn-primary" onClick={() => act({ action: 'launch', lessonId: l.lessonId, classId: l.classId }, d => `Launched to ${d.launched} students.`)}>Launch</button>}
        </div>)
       : <p className="none">No teacher has planned a lesson for today. Nothing is wrong — start the children on their own next skill instead.</p>}
      {/* Always available, not only when nothing is planned: a lesson can finish early, or a
          child can arrive after it was launched. */}
      <div className="lrow">
       <div><strong>Their own next skill</strong><span className="muted"> · each child carries on from where they are</span></div>
       <div className="row">
        <button type="button" className="btn btn-primary" onClick={() => act({ action: 'practiceAll', subject: 'reading' }, practiceMsg)}>Start reading</button>
        <button type="button" className="btn btn-primary" onClick={() => act({ action: 'practiceAll', subject: 'math' }, practiceMsg)}>Start math</button>
       </div>
      </div>
     </section>

     <NoteBox label="Note for everyone (VIC will follow it today)" onSave={note => act({ action: 'addNote', everyone: true, note }, d => `Added for ${d.added} students.`)} />

     <div className="grid">
      {sorted.map(s => <button key={s.id} type="button" className={`kid ${STATUS[s.status].cls}${open === s.id ? ' sel' : ''}`} onClick={() => setOpen(open === s.id ? null : s.id)}>
       <span className="kn">{s.short}</span>
       <span className="ks">{STATUS[s.status].icon} {s.status === 'quiet' && s.minutesQuiet != null ? `Quiet ${s.minutesQuiet} min` : STATUS[s.status].word}</span>
       <span className="kl">{s.lessons[0]?.title || (s.lastWith === 'own' ? 'My own work' : s.status === 'out' ? '' : 'No lesson yet')}</span>
       {(s.goals?.met + s.goals?.partly + s.goals?.not_yet) > 0 && <span className="kt">Skills: {s.goals.met} met · {s.goals.partly} partly · {s.goals.not_yet} not yet</span>}
       {s.notes.length > 0 && <span className="kt">📝 {s.notes.length}</span>}
       {s.locked && <span className="kt">🔒 Locked</span>}
      </button>)}
     </div>

     {student && <section className="panel detail" aria-label={student.name}>
      <div className="dh"><h2>{student.name}</h2><button type="button" className="btn btn-outline" onClick={() => setOpen(null)}>Close</button></div>
      <p className="muted">{student.classes.join(' · ')} · {student.turns} messages with VIC today</p>
      {student.alerts.length > 0 && <p className="warn">⚠ VIC flagged something this child said ({student.alerts.map(a => a.category).join(', ')}). Talk with them now. The teacher and school leader were emailed too.</p>}
      <p><strong>Skills today:</strong> {student.goals.met} met · {student.goals.partly} partly · {student.goals.not_yet} not yet</p>
      <p><strong>On today:</strong> {student.lessons.length ? student.lessons.map(l => l.title).join(', ') : 'Nothing launched yet. VIC will help with their own work.'}</p>
      <div><strong>Notes for VIC:</strong>{student.notes.length ? <ul>{student.notes.map(n => <li key={n.id}>{n.note} <button type="button" className="linkbtn" onClick={() => act({ action: 'clearNote', noteId: n.id })}>Remove</button></li>)}</ul> : <span className="muted"> none</span>}</div>
      <NoteBox label={`Add a note for VIC about ${student.short}`} onSave={note => act({ action: 'addNote', studentId: student.id, note }, () => 'Note added. VIC will use it on the next message.')} />
      <p><strong>Login pictures:</strong> <Pics keys={student.pictures} /> {student.locked && <button type="button" className="btn btn-outline sm" onClick={() => act({ action: 'unlock', studentId: student.id }, () => 'Unlocked. They can try again.')}>Unlock</button>} <button type="button" className="btn btn-outline sm" onClick={() => act({ action: 'newPictures', studentId: student.id }, () => 'New pictures made. Show them to the child.')}>New pictures</button></p>
     </section>}
    </> : <section className="panel cards-wrap">
     <div className="row noprint">
      <button type="button" className="btn btn-primary" onClick={() => act({ action: 'assignPictures' }, d => d.assigned ? `Pictures made for ${d.assigned} students.` : 'Everyone already has pictures.')}>Give pictures to everyone who needs them</button>
      <button type="button" className="btn btn-outline" onClick={() => window.print()}>Print picture cards</button>
     </div>
     <p className="muted noprint">On each computer: open <strong>askvic.ai/hello</strong> and type room code <strong className="code">{room.code}</strong> once. Then each child taps their name and their two pictures, in order. Keep these cards with you, not on the desks.</p>
     <div className="cards">{(room.students || []).map(s => <div key={s.id} className="card"><strong>{s.name}</strong><Pics keys={s.pictures} /><small>Room {room.code} · askvic.ai/hello</small></div>)}</div>
    </section>}
   </>}
  <style jsx>{`
   .top{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-top:12px}
   h1{margin:4px 0 6px;font-size:clamp(28px,3vw,38px)}
   .code{font-family:var(--font-mono);letter-spacing:.12em;font-size:1.1em}
   .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
   select{min-height:44px;border-radius:10px;padding:0 10px;font:inherit}
   .tabs{display:flex;gap:6px;border-bottom:1px solid var(--vic-border-soft)}
   .tabs button{padding:10px 14px;border:0;background:none;font:inherit;font-weight:800;color:var(--vic-text-secondary);border-bottom:3px solid transparent;cursor:pointer}
   .tabs button.on{color:var(--vic-text-primary);border-color:var(--vic-primary)}
   .summary{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
   .pill{padding:8px 12px;border-radius:12px;font-size:15px;border:2px solid var(--vic-border-soft);background:var(--vic-surface)}
   .pill.alert{border-color:var(--vic-danger)}
   .pill.quiet{border-color:#B45309}
   .pill.working{border-color:var(--vic-success)}
   .launch{display:flex;flex-direction:column;gap:10px}
   .lrow{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;border-top:1px solid var(--vic-border-soft);padding-top:10px}
   .ok{color:var(--vic-success);font-weight:800}
   .none{margin:0;color:var(--vic-text-secondary)}
   .warn{color:var(--vic-danger);font-weight:700}
   .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px}
   .kid{display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-align:left;padding:12px;border-radius:14px;border:2px solid var(--vic-border-soft);background:var(--vic-surface);cursor:pointer;font:inherit;color:var(--vic-text-primary);min-height:96px}
   .kid.sel{outline:3px solid var(--vic-primary)}
   .kid.alert{border-color:var(--vic-danger);background:var(--vic-danger-soft)}
   .kid.quiet{border-color:#B45309;border-style:dashed}
   .kid.out{opacity:.65}
   .kn{font-weight:800;font-size:17px}
   .ks{font-weight:800;font-size:14px}
   .kid.working .ks{color:var(--vic-success)}
   .kid.alert .ks{color:var(--vic-danger)}
   .kid.quiet .ks{color:#B45309}
   .kl{font-size:13.5px;color:var(--vic-text-secondary);line-height:1.3}
   .kt{font-size:13px;font-weight:700}
   .detail{display:flex;flex-direction:column;gap:10px;border:2px solid var(--vic-primary)}
   .dh{display:flex;justify-content:space-between;align-items:center;gap:10px}
   .dh h2{margin:0}
   .detail p{margin:0}
   .linkbtn{background:none;border:0;color:var(--vic-primary);text-decoration:underline;cursor:pointer;font:inherit}
   .sm{min-height:34px;padding:4px 10px;font-size:14px}
   :global(.pics){display:inline-flex;gap:6px;font-size:26px;vertical-align:middle}
   .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-top:12px}
   .card{border:2px dashed var(--vic-border);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:6px;break-inside:avoid}
   .card :global(.pics){font-size:40px}
   .card small{color:var(--vic-text-secondary)}
   @media print{:global(header),:global(nav),.noprint,.tabs,.top{display:none!important}.cards{grid-template-columns:repeat(3,1fr)}}
  `}</style>
 </PageShell>
}

// What the aide is told after starting practice for the group. Names anyone who could not be
// started: she is standing in the room and can act on it, where a silent skip helps nobody.
function practiceMsg(d) {
 const bits = []
 if (d.started) bits.push(`Started ${d.started}`)
 if (d.resumed) bits.push(`${d.resumed} already working`)
 let msg = bits.length ? `${bits.join(' · ')}.` : 'Nobody needed starting.'
 if (d.skipped?.length) msg += ` Could not start ${d.skipped.length}: ${d.skipped.map(s => `${s.name} (${s.why})`).join(', ')}`
 return msg
}

function NoteBox({ label, onSave }) {
 const [text, setText] = useState('')
 return <form className="note" onSubmit={e => { e.preventDefault(); if (text.trim()) { onSave(text.trim()); setText('') } }}>
  <label>{label}<input value={text} onChange={e => setText(e.target.value)} maxLength={600} placeholder="For example: practice 7s and 8s multiplication facts" /></label>
  <button type="submit" className="btn btn-outline">Add</button>
  <style jsx>{`
   .note{display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap}
   label{display:flex;flex-direction:column;gap:4px;font-weight:700;flex:1 1 320px;min-width:0}
   input{min-height:44px;border-radius:10px;border:1px solid var(--vic-border);padding:0 12px;font:inherit;font-weight:400}
  `}</style>
 </form>
}

function RoomSetup({ list, room, onDone, onCancel }) {
 const [name, setName] = useState(room?.name || 'VIC Room'), [ids, setIds] = useState(room?.classes?.map(c => c.id) || []), [emails, setEmails] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState('')
 async function save(e) {
  e.preventDefault(); setBusy(true); setErr('')
  try {
   const staffEmails = emails.split(/[\s,;]+/).filter(Boolean)
   const d = await api('/api/room/manage', { action: room ? 'update' : 'create', roomId: room?.id, name, classIds: ids, ...(emails.trim() || !room ? { staffEmails } : {}) })
   await onDone(room ? room.id : d.id)
  } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
 }
 return <form className="panel setup" onSubmit={save}>
  <p className="label">{room ? 'Edit room' : 'Set up a VIC Room'}</p>
  <h1>{room ? room.name : 'One room, one adult, every child with VIC'}</h1>
  <label>Room name<input value={name} onChange={e => setName(e.target.value)} maxLength={120} /></label>
  <fieldset><legend>Which classes learn in this room?</legend>
   {list.classes.length ? list.classes.map(c => <label key={c.id} className="chk"><input type="checkbox" checked={ids.includes(c.id)} onChange={e => setIds(e.target.checked ? [...ids, c.id] : ids.filter(x => x !== c.id))} /> {c.name}{c.teacher ? ` · ${c.teacher}` : ''}</label>) : <p className="muted">You have no classes yet.</p>}
  </fieldset>
  {room && list.leader && <OldClasses roomId={room.id} />}
  <label>Aide’s AskVic email{room ? ' (leave blank to keep the current aides)' : ''}<input value={emails} onChange={e => setEmails(e.target.value)} placeholder="aide@school.org" /></label>
  {err && <p className="alert" role="alert">{err}</p>}
  <div className="row"><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : room ? 'Save' : 'Create room'}</button>{onCancel && <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>}</div>
  <style jsx>{`
   .setup{display:flex;flex-direction:column;gap:14px;max-width:720px}
   h1{margin:0;font-size:clamp(24px,3vw,32px)}
   label{display:flex;flex-direction:column;gap:6px;font-weight:700}
   input:not([type]){min-height:44px;border-radius:10px;border:1px solid var(--vic-border);padding:0 12px;font:inherit;font-weight:400}
   fieldset{border:1px solid var(--vic-border-soft);border-radius:12px;padding:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:6px}
   legend{font-weight:800;padding:0 6px}
   .chk{flex-direction:row;align-items:center;font-weight:500}
   .row{display:flex;gap:10px}
  `}</style>
 </form>
}

// After moving students into a room's classes, take them out of the classes they were in before.
function OldClasses({ roomId }) {
 const [preview, setPreview] = useState(null), [done, setDone] = useState(''), [err, setErr] = useState(''), [sure, setSure] = useState(false)
 useEffect(() => { api('/api/room/manage', { action: 'leaveOldClasses', roomId }).then(d => setPreview(d.preview)).catch(e => setErr(e.message)) }, [roomId])
 if (err) return <p className="alert">{err}</p>
 if (!preview) return null
 if (done) return <p className="notice">{done}</p>
 if (!preview.length) return <p className="muted">Everyone in this room is only in the room’s classes.</p>
 return <div className="old">
  <p><strong>These students are still in their old classes too:</strong> {preview.map(p => `${p.name} (${p.students})`).join(', ')}.</p>
  {!sure ? <button type="button" className="btn btn-outline" onClick={() => setSure(true)}>Take them out of the old classes</button>
   : <span className="row"><strong>Sure? Their accounts and past work stay.</strong><button type="button" className="btn btn-primary" onClick={() => api('/api/room/manage', { action: 'leaveOldClasses', roomId, confirm: true }).then(d => setDone(`Done. ${d.removed} old class spots removed.`)).catch(e => setErr(e.message))}>Yes, take them out</button><button type="button" className="btn btn-outline" onClick={() => setSure(false)}>Cancel</button></span>}
  <style jsx>{`.old{border:2px solid var(--vic-primary);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px}.old p{margin:0}.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}`}</style>
 </div>
}

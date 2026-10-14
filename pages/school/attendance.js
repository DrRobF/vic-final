import { useEffect, useState } from 'react'
import PageShell, { PanelStyles } from '../../components/PageShell'
import { supabase } from '../../lib/supabase'
import { ATTENDANCE_FIELDS, ABSENCE_FIELDS } from '../../lib/staff-attendance.mjs'

async function api(method, body, query = '') {
 const { data: { session } } = await supabase.auth.getSession()
 if (!session) { window.location.replace('/school-login'); throw new Error('Please log in.') }
 const r = await fetch(`/api/school/attendance${query}`, { method, headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
 const d = await r.json().catch(() => ({}))
 if (!r.ok) throw new Error(d.error || 'Something went wrong.')
 return d
}
const SHEETS = { attendance: { title: 'Check-in log', hint: 'The sheet your sign-in computer fills: one row per person per day.' }, absences: { title: 'Absence form', hint: 'Google Form responses where staff report an absence.' } }
const fmtDay = d => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
const fmtTime = t => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` }

function TodayBadge({ t }) {
 if (t.kind === 'in') return <span className="tb in">✓ In {fmtTime(t.time)}</span>
 if (t.kind === 'late') return <span className="tb late">Late {fmtTime(t.time)}{t.minutes ? ` · ${t.minutes} min` : ''}</span>
 if (t.kind === 'absent_form') return <span className="tb form">Absent · {t.type || 'form on file'}{t.portion && !/whole/i.test(t.portion) ? ` (${t.portion})` : ''}</span>
 if (t.kind === 'absent_no_form') return <span className="tb noform">Absent · no form</span>
 return <span className="tb wait">Not in yet</span>
}

// Staff attendance, read from the school's own Google Sheets. Leaders only.
export default function StaffAttendance() {
 const [schools, setSchools] = useState(null), [schoolId, setSchoolId] = useState(''), [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(''), [connecting, setConnecting] = useState(''), [note, setNote] = useState(null), [msg, setMsg] = useState('')

 useEffect(() => { api('GET').then(d => { setSchools(d.schools); setSchoolId(d.schools[0]?.id || '') }).catch(e => setError(e.message)) }, [])
 async function load(refresh = false) { if (!schoolId) return; setBusy(refresh ? 'Reading your sheets…' : ''); setError(''); try { setData(await api('GET', null, `?schoolId=${encodeURIComponent(schoolId)}${refresh ? '&refresh=1' : ''}`)) } catch (e) { setError(e.message) } finally { setBusy('') } }
 useEffect(() => { load() }, [schoolId])
 async function act(body, done) { setError(''); setMsg(''); try { const d = await api('POST', { schoolId, ...body }); done?.(d); await load() } catch (e) { setError(e.message) } }
 async function draft(person, topic) { setError(''); try { const d = await api('POST', { schoolId, action: 'draft', staffId: person.id, topic }); setNote({ person, ...d.draft, to: d.to }) } catch (e) { setError(e.message) } }
 async function send() { setBusy('Sending…'); try { const d = await api('POST', { schoolId, action: 'send', staffId: note.person.id, subject: note.subject, body: note.body }); setMsg(`Sent to ${note.person.name} (${d.to}).`); setNote(null) } catch (e) { setError(e.message) } finally { setBusy('') } }

 const links = data?.links || [], linked = Object.fromEntries(links.map(l => [l.kind, l]))
 const people = data?.people || []
 const attention = people.filter(p => p.today.kind === 'absent_no_form' || p.noFormDays.length || p.missingOut.length)

 return <PageShell title="Staff attendance" currentPath="/school/attendance">
  <PanelStyles />
  <a className="back" href="/school">← School dashboard</a>
  <header className="top">
   <div><p className="label">Staff attendance</p><h1>Who’s here today</h1>{data && <p className="muted">{fmtDay(data.today)} · read from your Google Sheets{links[0]?.lastSyncedAt ? ` · updated ${new Date(Math.max(...links.map(l => Date.parse(l.lastSyncedAt || 0)))).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}</p>}</div>
   {links.length > 0 && <button type="button" className="btn btn-outline" disabled={!!busy} onClick={() => load(true)}>{busy === 'Reading your sheets…' ? busy : 'Read sheets now'}</button>}
  </header>
  {schools && schools.length > 1 && <label className="pick">School <select value={schoolId} onChange={e => setSchoolId(e.target.value)}>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
  {error && <p className="alert" role="alert">{error}</p>}{msg && <p className="notice" role="status">{msg}</p>}
  {schools && !schools.length && <section className="panel"><h2>Set up your school first</h2><p>Create your school and staff list on Staff &amp; deadlines, then come back.</p><a className="btn btn-primary" href="/assistantprincipal">Open Staff &amp; deadlines</a></section>}
  {schoolId && !data && !error && <p role="status">Loading…</p>}

  {data && <>
   {!links.length ? <section className="dark-panel intro"><h2 className="dh">Connect your sheets once. VIC reads them every time you open this page.</h2><p>Nobody types anything twice. Your sign-in computer keeps writing to your sheet like it does now; AskVic reads it, read-only.</p></section> : <>
    <div className="stats">
     <div className="stat"><strong>{data.summary.in}</strong><span>In on time</span></div>
     <div className="stat"><strong className="warn">{data.summary.late}</strong><span>Late</span></div>
     <div className="stat"><strong>{data.summary.absentForm}</strong><span>Absent, form on file</span></div>
     <div className="stat"><strong className="bad">{data.summary.absentNoForm}</strong><span>Absent, no form</span></div>
     <div className="stat"><strong>{data.summary.waiting}</strong><span>{data.todayIsSchoolDay ? 'Not in yet' : 'No check-ins yet today'}</span></div>
    </div>

    {note && <section className="panel note" aria-label="Reminder draft">
     <p className="label">Draft for {note.person.name} · nothing is sent until you click Send</p>
     <label>To<input value={note.to || 'No email on file. Add one on Staff & deadlines.'} disabled /></label>
     <label>Subject<input value={note.subject} maxLength={200} onChange={e => setNote({ ...note, subject: e.target.value })} /></label>
     <label>Message<textarea rows={7} value={note.body} maxLength={4000} onChange={e => setNote({ ...note, body: e.target.value })} /></label>
     <div className="row"><button type="button" className="btn btn-primary" disabled={!!busy || !note.to} onClick={send}>{busy === 'Sending…' ? busy : 'Send'}</button><button type="button" className="btn btn-outline" onClick={() => setNote(null)}>Cancel</button></div>
    </section>}

    {attention.length > 0 && <section className="panel">
     <p className="label">Needs your attention</p>
     <ul className="att">{attention.map(p => <li key={p.id}>
      <strong>{p.name}</strong>
      <span className="why">{[p.noFormDays.length ? `No absence form: ${p.noFormDays.slice(-3).map(fmtDay).join(', ')}` : '', p.missingOut.length ? `Forgot to clock out (hourly): ${p.missingOut.slice(-3).map(fmtDay).join(', ')}` : ''].filter(Boolean).join(' · ')}</span>
      <span className="acts">{p.noFormDays.length > 0 && <button type="button" className="btn btn-outline sm" onClick={() => draft(p, 'no_form')}>Draft a note</button>}{p.missingOut.length > 0 && <button type="button" className="btn btn-outline sm" onClick={() => draft(p, 'missing_out')}>Draft clock-out note</button>}</span>
     </li>)}</ul>
    </section>}

    <section className="panel tablewrap">
     <p className="label">Everyone · school year so far ({data.schoolDays} school days)</p>
     <table>
      <thead><tr><th>Name</th><th>Today</th><th>Late</th><th>Absences</th><th>Pay</th></tr></thead>
      <tbody>{people.map(p => <tr key={p.id}>
       <td className="nm">{p.name}{p.formProblems.length > 0 && <small title={p.formProblems.join('\n')}>Form has a date typo</small>}</td>
       <td><TodayBadge t={p.today} /></td>
       <td>{p.lateCount ? `${p.lateCount}×${p.lateMinutes ? ` · ${p.lateMinutes} min` : ''}` : '—'}</td>
       <td>{p.absences ? <>{p.absences}{p.absences > p.absencesWithForm ? <span className="nf"> · {p.absences - p.absencesWithForm} no form</span> : ''}</> : '—'}</td>
       <td><select aria-label={`Pay type for ${p.name}`} value={p.payType} onChange={e => act({ action: 'set_pay', staffId: p.id, payType: e.target.value })}><option value="salaried">Salaried</option><option value="hourly">Hourly</option></select></td>
      </tr>)}</tbody>
     </table>
     <small className="muted">Absences count school days with no check-in. A school day is any day most staff checked in, so holidays never count. Missing clock-outs only matter for hourly staff.</small>
    </section>

    {data.unmatched.length > 0 && <section className="panel">
     <p className="label">Names VIC couldn’t match</p>
     <p>These names appear in your sheets but not on your staff list. Pick who each one is, once.</p>
     <ul className="um">{data.unmatched.map(u => <li key={u.key}><span>{u.name}</span><select defaultValue="" onChange={e => e.target.value && act({ action: 'alias', key: u.key, staffId: e.target.value })}><option value="">Who is this?</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></li>)}</ul>
    </section>}
   </>}

   <section className="panel">
    <p className="label">Your sheets</p>
    <div className="sheets">{Object.entries(SHEETS).map(([kind, s]) => {
     const l = linked[kind]
     return <div key={kind} className="sheet">
      <h3>{s.title}</h3>
      {l ? <>
       <p className={l.lastError ? 'bad' : 'ok'}>{l.lastError ? l.lastError : `Connected · tab “${l.tab}” · ${l.rows ?? 0} rows read`}</p>
       {l.problems?.length > 0 && <details><summary>{l.problems.length} rows VIC couldn’t read</summary><ul>{l.problems.map((p, i) => <li key={i}>{p}</li>)}</ul></details>}
       {kind === 'attendance' && <label className="ontime">On time means checked in by <input type="time" defaultValue={l.onTime} onBlur={e => act({ action: 'set_on_time', onTime: e.target.value })} /> <small>(leave blank to use your sheet’s Status column)</small></label>}
       <div className="row"><button type="button" className="btn btn-outline sm" onClick={() => setConnecting(kind)}>Change</button><button type="button" className="linkbtn" onClick={() => act({ action: 'remove_link', kind })}>Disconnect</button></div>
      </> : <><p className="muted">{s.hint}</p><button type="button" className="btn btn-primary sm" onClick={() => setConnecting(kind)}>Connect</button></>}
      {connecting === kind && <Connect kind={kind} schoolId={schoolId} serviceEmail={data.serviceEmail} existing={l} onDone={() => { setConnecting(''); load() }} onCancel={() => setConnecting('')} />}
     </div>
    })}</div>
   </section>
  </>}
  <style jsx>{`
   .back{font-weight:800;text-decoration:none}
   .top{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}
   h1{margin:0 0 4px;font-size:clamp(30px,3.4vw,42px)}
   .pick{display:flex;gap:8px;align-items:center;font-weight:800}
   .dh{color:#fff;margin:0 0 8px}
   .stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
   .stat{background:var(--vic-ink);color:var(--vic-ink-text);border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:4px}
   .stat strong{font-family:var(--font-head);font-size:32px;line-height:1}
   .stat strong.warn{color:#FBBF24}.stat strong.bad{color:var(--vic-volt)}
   .stat span{font-size:14px;color:var(--vic-ink-muted)}
   .note label{display:flex;flex-direction:column;gap:6px;font-weight:800;margin:10px 0}
   .note input,.note textarea{padding:11px 12px;border:1px solid var(--vic-field-border);border-radius:10px;font:inherit;font-size:16px}
   .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:10px}
   .att{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px}
   .att li{display:grid;grid-template-columns:200px 1fr auto;gap:12px;align-items:center;padding:10px 0;border-top:1px solid var(--vic-border-soft)}
   .why{color:var(--vic-text-secondary);font-size:15px}
   .acts{display:flex;gap:8px}
   :global(.sm){min-height:38px!important;padding:7px 12px!important;font-size:14px!important}
   .tablewrap{overflow-x:auto}
   table{width:100%;border-collapse:collapse;font-size:15px;margin:6px 0 10px}
   th{text-align:left;font-family:var(--font-mono);font-size:13px;text-transform:uppercase;color:var(--vic-text-secondary);padding:8px;border-bottom:2px solid var(--vic-border)}
   td{padding:9px 8px;border-bottom:1px solid var(--vic-border-soft);vertical-align:middle}
   .nm{font-weight:800}.nm small{display:block;font-weight:600;color:var(--vic-danger);font-size:12px}
   .nf{color:var(--vic-danger);font-weight:800}
   td select{padding:6px 8px;border-radius:8px;border:1px solid var(--vic-border);font:inherit;font-size:14px}
   :global(.tb){display:inline-block;padding:4px 10px;border-radius:999px;font-weight:800;font-size:13px;white-space:nowrap}
   :global(.tb.in){background:var(--lvl-onlevel-soft);color:var(--lvl-onlevel-ink)}
   :global(.tb.late){background:var(--lvl-enrich-soft);color:var(--lvl-enrich-ink)}
   :global(.tb.form){background:var(--lvl-support-soft);color:var(--lvl-support-ink)}
   :global(.tb.noform){background:var(--vic-danger-soft);color:#912018}
   :global(.tb.wait){background:var(--vic-surface-muted);color:var(--vic-text-secondary)}
   .um{list-style:none;padding:0;margin:10px 0 0;display:flex;flex-direction:column;gap:8px}
   .um li{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.um span{font-weight:800;min-width:180px}
   .um select{padding:8px;border-radius:8px;border:1px solid var(--vic-border);font:inherit}
   .sheets{display:grid;grid-template-columns:1fr 1fr;gap:16px}
   .sheet{border:1px solid var(--vic-border-soft);border-radius:14px;padding:16px}
   .sheet h3{margin:0 0 6px}.ok{color:var(--vic-success)!important;font-weight:700}.bad{color:var(--vic-danger)!important;font-weight:700}
   .ontime{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px;font-weight:700}
   .ontime input{padding:6px 8px;border-radius:8px;border:1px solid var(--vic-border);font:inherit}
   .linkbtn{background:none;border:0;color:var(--vic-text-secondary);text-decoration:underline;cursor:pointer;font-weight:700}
   @media(max-width:860px){.stats{grid-template-columns:repeat(2,1fr)}.sheets{grid-template-columns:1fr}.att li{grid-template-columns:1fr}}
  `}</style>
 </PageShell>
}

function Connect({ kind, schoolId, serviceEmail, existing, onDone, onCancel }) {
 const [url, setUrl] = useState(existing ? `https://docs.google.com/spreadsheets/d/${existing.spreadsheetId}/edit` : ''), [info, setInfo] = useState(null), [mapping, setMapping] = useState(existing?.mapping || {}), [onTime, setOnTime] = useState(existing?.onTime || ''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [copied, setCopied] = useState(false)
 const fields = kind === 'attendance' ? ATTENDANCE_FIELDS : ABSENCE_FIELDS
 async function inspect(tab) { setBusy(true); setError(''); try { const d = await api('POST', { schoolId, action: 'inspect', kind, url, tab }); setInfo(d); setMapping(m => tab || !existing ? d.mapping : m) } catch (e) { setError(e.message) } finally { setBusy(false) } }
 async function save() { setBusy(true); setError(''); try { await api('POST', { schoolId, action: 'save_link', kind, url, tab: info.tab, mapping, onTime }); onDone() } catch (e) { setError(e.message) } finally { setBusy(false) } }
 return <div className="connect">
  <ol>
   <li><strong>Share the sheet with AskVic.</strong> In Google Sheets, click <em>Share</em>, paste this address and choose <em>Viewer</em>:
    <div className="email"><code>{serviceEmail || 'Google isn’t set up on the server yet'}</code><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(serviceEmail); setCopied(true) } catch {} }}>{copied ? '✓ Copied' : 'Copy'}</button></div></li>
   <li><strong>Paste the sheet’s link</strong> from your browser’s address bar:
    <div className="email"><input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" /><button type="button" disabled={busy || !url} onClick={() => inspect()}>{busy && !info ? 'Checking…' : 'Check'}</button></div></li>
  </ol>
  {error && <p className="err" role="alert">{error}</p>}
  {info && <>
   <p className="ok">✓ AskVic can read “{info.title}.”</p>
   <label className="f">Tab<select value={info.tab} onChange={e => inspect(e.target.value)}>{info.tabs.map(t => <option key={t}>{t}</option>)}</select></label>
   <p className="hint">Match your columns. VIC guessed; fix anything that’s wrong.{info.hidden.length ? ` For privacy, AskVic never reads: ${info.hidden.join(', ')}.` : ''}</p>
   <div className="map">{fields.map(f => <label key={f.key} className="f">{f.label}{f.required ? ' *' : ''}<select value={mapping[f.key] || ''} onChange={e => setMapping({ ...mapping, [f.key]: e.target.value })}><option value="">{f.required ? 'Choose a column' : 'Not in my sheet'}</option>{info.headers.map(h => <option key={h} value={h}>{h}</option>)}</select></label>)}</div>
   {kind === 'attendance' && <label className="f">On time means checked in by (optional)<input type="time" value={onTime} onChange={e => setOnTime(e.target.value)} /></label>}
   {info.sample.length > 0 && <details><summary>See the first rows VIC read</summary><div className="sample"><table><thead><tr>{info.headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{info.sample.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div></details>}
   <div className="row"><button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save and read the sheet'}</button><button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button></div>
  </>}
  {!info && <div className="row"><button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button></div>}
  <style jsx>{`
   .connect{margin-top:14px;padding:14px;border-radius:12px;background:var(--vic-surface-muted)}
   ol{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:12px}
   .email{display:flex;gap:8px;margin-top:6px;flex-wrap:wrap}
   code{background:var(--vic-surface);padding:8px 10px;border-radius:8px;font-size:13px;word-break:break-all;flex:1}
   .email input{flex:1;min-width:200px;padding:9px 10px;border-radius:8px;border:1px solid var(--vic-field-border);font:inherit;font-size:15px}
   .email button{padding:8px 14px;border-radius:8px;border:0;background:var(--vic-ink);color:#fff;font-weight:800;cursor:pointer}
   .err{color:var(--vic-danger);font-weight:700}.ok{color:var(--vic-success);font-weight:800}
   .hint{font-size:14px;color:var(--vic-text-secondary)}
   .map{display:grid;grid-template-columns:1fr 1fr;gap:10px}
   .f{display:flex;flex-direction:column;gap:4px;font-weight:800;font-size:14px;margin:6px 0}
   .f select,.f input{padding:8px;border-radius:8px;border:1px solid var(--vic-border);font:inherit;font-size:15px;font-weight:500}
   .sample{overflow-x:auto;max-width:100%}
   .sample table{font-size:12px;border-collapse:collapse}.sample th,.sample td{padding:4px 6px;border:1px solid var(--vic-border-soft);white-space:nowrap}
   .row{display:flex;gap:10px;margin-top:12px;flex-wrap:wrap}
   @media(max-width:700px){.map{grid-template-columns:1fr}}
  `}</style>
 </div>
}

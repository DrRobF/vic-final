import Head from 'next/head'
import { useEffect, useRef, useState } from 'react'

const TOKEN_KEY = 'askvic-kiosk-token', QUEUE_KEY = 'askvic-kiosk-queue'
const read = k => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch {} }
const fmt12 = t => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` }

// The office check-in screen. Full screen, big keys, works with a keyboard or a touch screen.
export default function Kiosk() {
 const [token, setToken] = useState(null), [info, setInfo] = useState(null), [notKiosk, setNotKiosk] = useState(false)
 const [setupCode, setSetupCode] = useState(''), [setupErr, setSetupErr] = useState(''), [code, setCode] = useState(''), [msg, setMsg] = useState(null), [busy, setBusy] = useState(false), [now, setNow] = useState(new Date()), [queued, setQueued] = useState(0)
 const input = useRef(null), clearTimer = useRef(null)

 useEffect(() => { const t = read(TOKEN_KEY); setToken(t || ''); if (!t) setNotKiosk(true) }, [])
 useEffect(() => { const id = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(id) }, [])

 async function loadInfo(t = token) {
  if (!t) return
  try {
   const r = await fetch('/api/kiosk', { headers: { 'x-kiosk-token': t } })
   const d = await r.json().catch(() => ({}))
   if (d.notKiosk) { setNotKiosk(true); return }
   if (r.ok) setInfo(d)
  } catch {}
 }
 useEffect(() => { if (token) { loadInfo(token); const id = setInterval(() => loadInfo(token), 5 * 60 * 1000); return () => clearInterval(id) } }, [token])

 // Send anything saved while the internet was down.
 async function flush() {
  let q; try { q = JSON.parse(read(QUEUE_KEY) || '[]') } catch { q = [] }
  if (!q.length || !token) { setQueued(0); return }
  const left = []
  for (const item of q) {
   try { const r = await fetch('/api/kiosk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, code: item.code, queuedAt: item.at }) }); if (r.status >= 500) left.push(item) } catch { left.push(item) }
  }
  write(QUEUE_KEY, left.length ? JSON.stringify(left) : null); setQueued(left.length)
 }
 useEffect(() => { if (token) { flush(); const id = setInterval(flush, 30000); return () => clearInterval(id) } }, [token])

 function show(m) { setMsg(m); clearTimeout(clearTimer.current); clearTimer.current = setTimeout(() => { setMsg(null); input.current?.focus() }, m.ok ? 4000 : 6000) }
 async function submit(e) {
  e?.preventDefault()
  if (busy || code.length < 4) return
  setBusy(true)
  const typed = code; setCode('')
  try {
   const r = await fetch('/api/kiosk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, code: typed }) })
   const d = await r.json().catch(() => ({}))
   if (d.notKiosk) setNotKiosk(true)
   show(r.ok ? { ok: true, text: d.message } : { ok: false, text: d.error || 'That didn’t work. Please try again.' })
  } catch {
   let q; try { q = JSON.parse(read(QUEUE_KEY) || '[]') } catch { q = [] }
   q.push({ code: typed, at: new Date().toISOString() }); write(QUEUE_KEY, JSON.stringify(q.slice(-200))); setQueued(q.length)
   show({ ok: true, text: 'Saved. The internet is down, so your check-in will send as soon as it’s back.' })
  } finally { setBusy(false); input.current?.focus() }
 }
 async function claim(e) {
  e.preventDefault(); setSetupErr('')
  try {
   const r = await fetch('/api/kiosk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'claim', setupCode }) })
   const d = await r.json().catch(() => ({}))
   if (!r.ok || !d.token) { setSetupErr(d.error || 'That code didn’t work.'); return }
   write(TOKEN_KEY, d.token); setToken(d.token); setNotKiosk(false); loadInfo(d.token)
  } catch { setSetupErr('No internet connection. Try again in a moment.') }
 }
 const press = k => { if (k === 'clear') setCode(''); else if (k === 'back') setCode(c => c.slice(0, -1)); else setCode(c => (c + k).slice(0, 6)); input.current?.focus() }

 const timeNow = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), dateNow = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
 const hasAnn = info && (info.morning?.trim() || info.afternoon?.trim())

 return <div className="k">
  <Head><title>{info?.school ? `${info.school} · Check in` : 'Check in'}</title><meta name="robots" content="noindex" /></Head>
  {notKiosk ? <main className="setup">
   <h1>This computer isn’t set up as the check-in kiosk</h1>
   <p>Have a setup code from your principal? Type it here.</p>
   <form onSubmit={claim} className="claim"><input value={setupCode} onChange={e => setSetupCode(e.target.value.toUpperCase())} placeholder="ABCD-1234" maxLength={9} autoFocus aria-label="Setup code" /><button type="submit" disabled={setupCode.replace(/[^A-Z0-9]/g, '').length !== 8}>Turn on kiosk</button></form>
   {setupErr && <p className="err" role="alert">{setupErr}</p>}
   <p className="small">School leaders: make a code on <strong>Staff attendance → AskVic check-in kiosk → Set up another computer</strong>, or <a href="/school-login?next=/school/attendance">log in here</a>.</p>
  </main> : <main>
   <header>
    <div className="brand"><span className="mark">{(info?.school || 'S').split(/\s+/).filter(w => /^[A-Z]/.test(w)).slice(0, 3).map(w => w[0]).join('') || 'S'}</span><div><p className="eyebrow">{info?.school || ' '}</p><h1>Staff check-in</h1></div></div>
    <div className="clock"><strong>{timeNow}</strong><span>{dateNow}</span></div>
   </header>
   <section className="card">
    <div className="left">
     <h2>Clock in or clock out</h2>
     <p>Type your staff code and press Enter.</p>
     {(info?.start || info?.end) && <div className="hours">{info.start && <span>Start <b>{fmt12(info.start)}</b></span>}{info.end && <span>End <b>{fmt12(info.end)}</b></span>}</div>}
     {msg && <p className={msg.ok ? 'msg ok' : 'msg bad'} role="status">{msg.text}</p>}
     {queued > 0 && <p className="queued">{queued} check-in{queued === 1 ? '' : 's'} waiting to send…</p>}
    </div>
    <form onSubmit={submit} className="right">
     <label htmlFor="code" className="sr">Staff code</label>
     <input id="code" ref={input} value={code.replace(/./g, '•')} onChange={() => {}} onKeyDown={e => { if (/^\d$/.test(e.key)) { e.preventDefault(); press(e.key) } else if (e.key === 'Backspace') { e.preventDefault(); press('back') } else if (e.key === 'Escape') press('clear') }} inputMode="numeric" autoComplete="off" autoFocus placeholder="••••" />
     <div className="pad">{['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'].map(k => <button type="button" key={k} className={k.length > 1 ? 'fn' : ''} onClick={() => press(k)}>{k === 'clear' ? 'Clear' : k === 'back' ? '⌫' : k}</button>)}</div>
     <button type="submit" className="go" disabled={busy || code.length < 4}>{busy ? 'One moment…' : 'Enter'}</button>
    </form>
   </section>
   <section className={hasAnn ? 'ann has' : 'ann'} aria-label="Announcements">
    {hasAnn && <p className="eyebrow volt">Please read today’s announcements</p>}
    <div className="annGrid">
     <article><p className="eyebrow">Morning</p><p>{info?.morning || 'No morning announcement.'}</p></article>
     <article><p className="eyebrow">Afternoon</p><p>{info?.afternoon || 'No afternoon announcement.'}</p></article>
    </div>
   </section>
  </main>}
  <style jsx>{`
   .k{min-height:100vh;background:radial-gradient(1100px 500px at 90% -10%,rgba(34,211,238,.16),transparent 60%),var(--vic-ink);color:var(--vic-ink-text);font-family:var(--font-body)}
   main{max-width:1180px;margin:0 auto;padding:28px 28px 40px;display:flex;flex-direction:column;gap:22px}
   header{display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap}
   .brand{display:flex;gap:16px;align-items:center}
   .mark{width:58px;height:58px;border-radius:16px;background:var(--vic-primary);display:grid;place-items:center;font-family:var(--font-head);font-weight:700;font-size:22px;color:#fff}
   .eyebrow{font-family:var(--font-mono);text-transform:uppercase;font-size:14px;color:var(--vic-cyan);margin:0 0 4px;letter-spacing:.04em}
   .volt{color:var(--vic-volt)}
   h1{margin:0;font-family:var(--font-head);font-size:38px;color:#fff}
   .clock{text-align:right;display:flex;flex-direction:column}
   .clock strong{font-family:var(--font-head);font-size:44px;color:#fff;line-height:1}
   .clock span{color:var(--vic-ink-muted);font-size:18px}
   .card{display:grid;grid-template-columns:1fr 420px;gap:32px;background:var(--vic-ink-2);border:1px solid var(--vic-ink-line);border-radius:26px;padding:32px}
   h2{margin:0 0 10px;font-size:34px;color:#fff;font-family:var(--font-head)}
   .left p{font-size:20px;color:var(--vic-ink-muted);margin:0}
   .hours{display:flex;gap:12px;margin-top:20px;flex-wrap:wrap}
   .hours span{padding:10px 16px;border-radius:12px;border:1px solid var(--vic-ink-line);font-size:18px}
   .hours b{color:#fff}
   .msg{margin-top:26px!important;padding:20px 22px;border-radius:16px;font-size:24px!important;font-weight:800;line-height:1.35}
   .msg.ok{background:var(--vic-volt);color:var(--vic-ink)!important}
   .msg.bad{background:#7F1D1D;color:#FEE2E2!important}
   .queued{margin-top:14px!important;color:#FBBF24!important;font-size:16px!important}
   .right{display:flex;flex-direction:column;gap:12px}
   input{width:100%;text-align:center;font-size:52px;letter-spacing:.3em;padding:14px;border-radius:16px;border:2px solid var(--vic-cyan);background:var(--vic-ink);color:#fff;font-family:var(--font-mono);caret-color:transparent}
   input:focus{outline:4px solid rgba(34,211,238,.35)}
   .pad{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
   .pad button{min-height:70px;border-radius:16px;border:1px solid var(--vic-ink-line);background:#1E2C5C;color:#fff;font-size:30px;font-weight:700;cursor:pointer}
   .pad button:active{background:var(--vic-primary)}
   .pad .fn{font-size:18px;color:var(--vic-ink-muted)}
   .go{min-height:72px;border-radius:16px;border:0;background:var(--vic-cyan);color:#06202A;font-size:26px;font-weight:800;cursor:pointer}
   .go:disabled{opacity:.45;cursor:not-allowed}
   .ann{border-radius:22px;padding:22px;border:1px solid var(--vic-ink-line)}
   .ann.has{border:2px solid var(--vic-volt)}
   .annGrid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
   .ann article p:last-child{font-size:20px;line-height:1.5;margin:0;white-space:pre-wrap}
   .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
   .setup{max-width:640px;padding-top:12vh}
   .setup p{font-size:20px;line-height:1.6;color:var(--vic-ink-muted)}
   .setup a{color:var(--vic-cyan);font-weight:800}
   .claim{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}
   .claim input{flex:1;min-width:220px;text-align:center;font-size:34px;letter-spacing:.15em;padding:12px;border-radius:14px;border:2px solid var(--vic-cyan);background:var(--vic-ink);color:#fff;font-family:var(--font-mono);text-transform:uppercase}
   .claim button{padding:0 26px;border-radius:14px;border:0;background:var(--vic-cyan);color:#06202A;font-weight:800;font-size:20px;cursor:pointer}
   .claim button:disabled{opacity:.45}
   .err{color:#FCA5A5!important;font-weight:700}
   .small{font-size:16px!important}
   @media(max-width:900px){.card{grid-template-columns:1fr}.annGrid{grid-template-columns:1fr}.clock{text-align:left}}
  `}</style>
 </div>
}

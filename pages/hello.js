import Head from 'next/head'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PICTURES, ROOM_CODE, cleanRoomCode } from '../lib/room-pictures.mjs'

const ROOM_KEY = 'askvic-room-code'
const readRoom = () => { try { return localStorage.getItem(ROOM_KEY) || '' } catch { return '' } }
const saveRoom = code => { try { code ? localStorage.setItem(ROOM_KEY, code) : localStorage.removeItem(ROOM_KEY) } catch {} }

// Student picture login. The aide types the room code once on each computer. After that a child
// taps their name, then their two secret pictures. No typing, no camera.
export default function Hello() {
 const [code, setCode] = useState(''), [typed, setTyped] = useState('')
 const [room, setRoom] = useState(null), [error, setError] = useState('')
 const [me, setMe] = useState(null), [picked, setPicked] = useState([]), [busy, setBusy] = useState(false), [msg, setMsg] = useState('')

 useEffect(() => { setCode(readRoom()) }, [])
 useEffect(() => {
  if (!code) { setRoom(null); return }
  setError('')
  fetch(`/api/room/roster?code=${encodeURIComponent(code)}`).then(async r => {
   const d = await r.json().catch(() => ({}))
   if (!r.ok) { setError(d.error || 'Could not open this room.'); if (r.status === 404) { saveRoom(''); setCode('') } return }
   setRoom(d)
  }).catch(() => setError('Check the Wi-Fi, then try again.'))
 }, [code])

 function chooseRoom(e) {
  e.preventDefault()
  const c = cleanRoomCode(typed)
  if (!ROOM_CODE.test(c)) { setError('Room codes have 6 letters and numbers.'); return }
  saveRoom(c); setCode(c)
 }
 async function tap(key) {
  if (busy || picked.length >= 2) return
  const next = [...picked, key]
  setPicked(next); setMsg('')
  if (next.length < 2) return
  setBusy(true)
  try {
   const r = await fetch('/api/room/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, studentId: me.id, pictures: next }) })
   const d = await r.json().catch(() => ({}))
   if (!r.ok) { setMsg(d.error || 'Not quite. Try again.'); setPicked([]); setBusy(false); return }
   await supabase.auth.signOut().catch(() => {})
   const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: d.tokenHash, type: 'magiclink' })
   if (otpError) throw otpError
   window.location.replace('/learn')
  } catch { setMsg('Login is busy. Try again.'); setPicked([]); setBusy(false) }
 }

 return <main className="hello">
  <Head><title>Hello | AskVic</title><meta name="robots" content="noindex" /></Head>
  {!code ? <section className="box">
   <h1>Set up this computer</h1>
   <p>Grown-ups: type the room code from the VIC Room screen. This computer will remember it.</p>
   <form onSubmit={chooseRoom}><label htmlFor="room-code">Room code</label><input id="room-code" value={typed} onChange={e => setTyped(cleanRoomCode(e.target.value))} placeholder="ABC234" autoComplete="off" autoCapitalize="characters" /><button type="submit" className="go">Use this room</button></form>
   {error && <p className="err" role="alert">{error}</p>}
   <a className="alt" href="/student-login">Log in with a username instead</a>
  </section>
  : !room ? <p className="big" role="status">{error || 'Opening your room…'}</p>
  : !me ? <section>
   <h1>Hi! Tap your name.</h1>
   <p className="sub">{room.name}</p>
   <div className="names">{room.students.map(s => <button key={s.id} type="button" className="name" disabled={!s.ready} onClick={() => { setMe(s); setPicked([]); setMsg('') }}>{s.name}</button>)}</div>
   {room.students.some(s => !s.ready) && <p className="note">Grayed-out names don’t have pictures yet. Ask your teacher.</p>}
   <div className="foot"><a href="/student-login">Use a username instead</a><button type="button" className="link" onClick={() => { saveRoom(''); setCode(''); setRoom(null) }}>Change room</button></div>
  </section>
  : <section>
   <h1>Hi, {me.name.split(' ')[0]}!</h1>
   <p className="sub">Tap your two secret pictures, in order.</p>
   <div className="dots" aria-label={`${picked.length} of 2 pictures tapped`}>{[0, 1].map(i => <span key={i} className={picked[i] ? 'dot on' : 'dot'}>{picked[i] ? PICTURES.find(p => p.key === picked[i]).emoji : i + 1}</span>)}</div>
   <div className="pics">{PICTURES.map(p => <button key={p.key} type="button" className="pic" disabled={busy} onClick={() => tap(p.key)} aria-label={p.label}><span aria-hidden="true">{p.emoji}</span><small>{p.label}</small></button>)}</div>
   {msg && <p className="err" role="alert">{msg}</p>}
   {busy && <p className="big" role="status">Logging you in…</p>}
   <button type="button" className="back" onClick={() => { setMe(null); setPicked([]); setMsg('') }}>← That’s not me</button>
  </section>}
  <style jsx>{`
   .hello{min-height:100vh;background:var(--vic-bg);color:var(--vic-text-primary);font-family:var(--font-read);padding:32px max(16px,env(safe-area-inset-left,0px)) 56px max(16px,env(safe-area-inset-right,0px));max-width:1100px;margin:0 auto}
   h1{font-size:clamp(32px,5vw,48px);margin:8px 0}
   .sub{font-size:22px;color:var(--vic-text-secondary);margin:0 0 20px}
   .big{font-size:24px}
   .box{max-width:520px;margin:40px auto;background:var(--vic-surface);border-radius:22px;padding:28px;border:1px solid var(--vic-border-soft)}
   .box p{font-size:18px;line-height:1.5}
   form{display:flex;flex-direction:column;gap:10px}
   label{font-weight:800}
   input{font-size:30px;letter-spacing:.2em;padding:12px 14px;border-radius:14px;border:2px solid var(--vic-border);text-transform:uppercase;font-family:var(--font-mono)}
   .go{min-height:56px;border:0;border-radius:14px;background:var(--vic-primary);color:#fff;font-size:20px;font-weight:800;cursor:pointer}
   .alt{display:inline-block;margin-top:16px;color:var(--vic-primary);font-weight:700}
   .names{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px}
   .name{min-height:72px;border-radius:18px;border:2px solid var(--vic-border);background:var(--vic-surface);font-family:var(--font-read);font-size:24px;font-weight:700;color:var(--vic-text-primary);cursor:pointer}
   .name:hover{border-color:var(--vic-primary);background:var(--vic-primary-soft)}
   .name:disabled{opacity:.4;cursor:not-allowed}
   .note{color:var(--vic-text-secondary);font-size:17px}
   .foot{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:28px;font-size:16px}
   .foot a,.link{color:var(--vic-text-secondary);background:none;border:0;text-decoration:underline;cursor:pointer;font:inherit}
   .dots{display:flex;gap:14px;margin:0 0 20px}
   .dot{width:76px;height:76px;border-radius:18px;border:3px dashed var(--vic-border);display:grid;place-items:center;font-size:40px;color:var(--vic-text-secondary)}
   .dot.on{border-style:solid;border-color:var(--vic-primary);background:var(--vic-primary-soft)}
   .pics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;max-width:760px}
   .pic{aspect-ratio:1;max-width:100%;border-radius:22px;border:2px solid var(--vic-border);background:var(--vic-surface);cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}
   .pic span{font-size:clamp(44px,7vw,64px);line-height:1}
   .pic small{font-size:16px;color:var(--vic-text-secondary);font-family:var(--font-read)}
   .pic:hover{border-color:var(--vic-primary);background:var(--vic-primary-soft)}
   .err{color:var(--vic-danger);font-weight:800;font-size:20px}
   .back{margin-top:24px;background:none;border:0;color:var(--vic-primary);font-size:20px;font-weight:700;cursor:pointer;font-family:var(--font-read)}
   @media(max-width:560px){.pics{grid-template-columns:repeat(3,minmax(0,1fr))}}
  `}</style>
 </main>
}

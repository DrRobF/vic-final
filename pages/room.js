import Head from 'next/head'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import VICHeader from '../components/VICHeader'
import { DEFAULT_ROOM, getRoom, roomIds } from '../lib/rooms.mjs'
import { speak, stopSpeaking, speechReady, warmVoices } from '../lib/speak'

// The Virtual Room — week 1 of docs/virtual-room-spec.md.
// A real place a child can stand in and look around, with props VIC can point at.
// No VIC yet, no lesson, no venue chooser. Just the room.
//
// Add ?place=1 to place props: click where a thing actually is and paste the
// coordinates into lib/rooms.mjs. Guessed positions are wrong positions.

const STEP = 90          // how far one arrow-key press turns, in pixels
const DRAG_SLOP = 6      // movement under this counts as a click, not a drag

export default function Room() {
 const [roomId, setRoomId] = useState(DEFAULT_ROOM)
 const [placeMode, setPlaceMode] = useState(false)
 const [offset, setOffset] = useState(0)        // pixels panned, wrapped to image width
 const [size, setSize] = useState(null)         // natural image size, once loaded
 const [status, setStatus] = useState('loading')
 const [openProp, setOpenProp] = useState(null)
 const [saying, setSaying] = useState('')
 const [placed, setPlaced] = useState(null)
 const [canSpeak, setCanSpeak] = useState(false)   // set on the client only: calling
                                                   // speechReady() during render would
                                                   // mismatch the server-rendered HTML

 const frameRef = useRef(null)
 const drag = useRef(null)

 const room = getRoom(roomId)

 useEffect(() => {
  const q = new URLSearchParams(window.location.search)
  if (q.get('place') === '1') setPlaceMode(true)
  const r = q.get('room')
  if (r && getRoom(r)) setRoomId(r)
  setCanSpeak(speechReady())
  warmVoices()
  return () => stopSpeaking()
 }, [])

 // Width the image is drawn at: it fills the frame's height and keeps its aspect ratio.
 const [frameH, setFrameH] = useState(0)
 useEffect(() => {
  const el = frameRef.current
  if (!el) return
  const measure = () => setFrameH(el.clientHeight)
  measure()
  const ro = new ResizeObserver(measure)
  ro.observe(el)
  return () => ro.disconnect()
 }, [status])

 const drawnW = useMemo(() => {
  if (!size || !frameH) return 0
  return Math.round(frameH * (size.w / size.h))
 }, [size, frameH])

 const wrap = useCallback(v => {
  if (!drawnW) return 0
  return ((v % drawnW) + drawnW) % drawnW
 }, [drawnW])

 const pan = useCallback(by => setOffset(o => wrap(o + by)), [wrap])

 // Dragging. Pointer events cover mouse, touch and pen with one code path.
 function onPointerDown(e) {
  if (!drawnW) return
  drag.current = { x: e.clientX, startOffset: offset, moved: 0 }
  e.currentTarget.setPointerCapture?.(e.pointerId)
 }
 function onPointerMove(e) {
  const d = drag.current
  if (!d) return
  const dx = e.clientX - d.x
  d.moved = Math.max(d.moved, Math.abs(dx))
  setOffset(wrap(d.startOffset - dx))
 }
 function onPointerUp(e) {
  const d = drag.current
  drag.current = null
  if (!d) return
  if (d.moved <= DRAG_SLOP && placeMode) readOutPosition(e)
 }

 // Placement mode: turn a click into coordinates for lib/rooms.mjs.
 function readOutPosition(e) {
  const el = frameRef.current
  if (!el || !drawnW) return
  const r = el.getBoundingClientRect()
  const withinFrame = e.clientX - r.left
  const onImage = wrap(offset + withinFrame)
  const deg = Math.round((onImage / drawnW) * 360)
  const y = Math.round(((e.clientY - r.top) / r.height) * 100)
  setPlaced({ x: ((deg % 360) + 360) % 360, y: Math.max(0, Math.min(100, y)) })
 }

 function onKeyDown(e) {
  if (e.key === 'ArrowRight') { e.preventDefault(); pan(STEP) }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); pan(-STEP) }
  else if (e.key === 'Home') { e.preventDefault(); setOffset(0) }
 }

 // Bring a prop into view when it is tabbed to, so keyboard users are not sent
 // to something off screen.
 const showProp = useCallback(p => {
  if (!drawnW || !frameRef.current) return
  const target = (p.x / 360) * drawnW
  const centred = wrap(target - frameRef.current.clientWidth / 2)
  setOffset(centred)
 }, [drawnW, wrap])

 function say(id, text) {
  if (saying === id) { stopSpeaking(); setSaying(''); return }
  setSaying(id)
  const ok = speak(text, { onEnd: () => setSaying(s => (s === id ? '' : s)) })
  if (!ok) setSaying('')
 }

 if (!room) return <main className="pad"><p>That room does not exist.</p></main>

 const propsFor = copy => room.props.map(p => ({
  ...p,
  left: copy * drawnW + (p.x / 360) * drawnW,
 }))

 return <div className="room">
  <Head><title>{room.title} | AskVic</title></Head>
  <div className="wrap"><VICHeader currentPath="/room" /></div>

  <main>
   <header className="top">
    <div>
     <p className="kicker">You are here</p>
     <h1>{room.title}</h1>
     <p className="where">
      {room.where}
      {canSpeak && <button type="button" className="spk inline" aria-label={saying === 'where' ? 'Stop reading' : 'Read this out loud'}
       aria-pressed={saying === 'where'} onClick={() => say('where', `${room.title}. ${room.where}`)}>
       {saying === 'where' ? '■' : '🔊'}
      </button>}
     </p>
    </div>
    {roomIds().length > 1 && <label className="pickroom">
     <span>Room</span>
     <select value={roomId} onChange={e => { setRoomId(e.target.value); setOffset(0); setOpenProp(null); setStatus('loading'); setSize(null) }}>
      {roomIds().map(id => <option key={id} value={id}>{getRoom(id).title}</option>)}
     </select>
    </label>}
   </header>

   {!room.propsVerified && <p className="warn" role="note">
    The marker positions in this room are guesses — nobody has checked them against the
    picture yet. Open <code>/room?place=1</code>, click each thing where it really is, and
    paste the numbers into <code>lib/rooms.mjs</code>.
   </p>}

   {placeMode && <div className="placebar" role="status">
    <strong>Placing props.</strong> Click a spot in the picture to get its coordinates.
    {placed && <code className="coords">x: {placed.x}, y: {placed.y}</code>}
    <a href={`/room?room=${roomId}`}>Done</a>
   </div>}

   <section
    className={`frame${placeMode ? ' placing' : ''}`}
    ref={frameRef}
    tabIndex={0}
    role="group"
    aria-label={`${room.title}. Drag, or use the left and right arrow keys, to look around.`}
    onKeyDown={onKeyDown}
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onPointerUp}
    onPointerCancel={() => { drag.current = null }}
   >
    {status === 'loading' && <p className="overlay" role="status">Opening the room…</p>}
    {status === 'error' && <div className="overlay bad" role="alert">
     <p><strong>The picture would not load.</strong></p>
     <p className="sm">Download it from <a href={room.source} target="_blank" rel="noreferrer">{room.credit}</a>,
      save it to <code>/public/rooms/</code>, and point <code>image</code> in <code>lib/rooms.mjs</code> at the local copy.</p>
    </div>}

    <div className="track" style={{ transform: `translate3d(${-offset}px,0,0)`, width: drawnW ? drawnW * 2 : undefined }}>
     {[0, 1].map(copy => <img
      key={copy}
      src={room.image}
      alt={copy === 0 ? `${room.title}. ${room.where}` : ''}
      aria-hidden={copy === 1 || undefined}
      draggable={false}
      style={{ left: copy * drawnW, width: drawnW || undefined }}
      onLoad={e => { setSize({ w: e.target.naturalWidth, h: e.target.naturalHeight }); setStatus('ready') }}
      onError={() => setStatus('error')}
     />)}

     {status === 'ready' && drawnW > 0 && [0, 1].map(copy => propsFor(copy).map((p, i) => <button
      key={`${copy}-${p.id}`}
      type="button"
      className={`prop${openProp === p.id ? ' on' : ''}`}
      style={{ left: p.left, top: `${p.y}%` }}
      tabIndex={copy === 0 ? 0 : -1}
      aria-hidden={copy === 1 || undefined}
      aria-expanded={openProp === p.id}
      onFocus={() => showProp(p)}
      onClick={() => { if (!placeMode) setOpenProp(openProp === p.id ? null : p.id) }}
     >
      <span className="dot" aria-hidden="true">{i + 1}</span>
      <span className="tag">{p.name}</span>
     </button>))}
    </div>

    <p className="hint" aria-hidden="true">drag, or ← →, to look around</p>
   </section>

   <p className="credit">Picture: {room.credit}{room.real ? ' — a real photograph of a real place' : ''}. <a href={room.source} target="_blank" rel="noreferrer">Source</a></p>

   {openProp && (() => {
    const p = room.props.find(x => x.id === openProp)
    if (!p) return null
    const aloud = `${p.name}. ${p.note}`
    return <aside className="panel" aria-live="polite">
     <div className="phead">
      <h2>{p.name}</h2>
      <div className="pbtns">
       {canSpeak && <button type="button" className="spk" aria-pressed={saying === p.id}
        aria-label={saying === p.id ? 'Stop reading' : 'Read this out loud'} onClick={() => say(p.id, aloud)}>
        {saying === p.id ? '■ Stop' : '🔊 Read it'}
       </button>}
       <button type="button" className="close" onClick={() => { setOpenProp(null); stopSpeaking(); setSaying('') }}>Close</button>
      </div>
     </div>
     <p className="note">{p.note}</p>
     <p className="tl">What you can learn here</p>
     <ul className="teaches">{p.teaches.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </aside>
   })()}

   <ol className="list" aria-label="Everything in this room">
    {room.props.map((p, i) => <li key={p.id}>
     <button type="button" className={openProp === p.id ? 'on' : ''} onClick={() => { setOpenProp(p.id); showProp(p) }}>
      <span className="n" aria-hidden="true">{i + 1}</span>{p.name}
     </button>
    </li>)}
   </ol>
  </main>

  <style jsx>{`
   .room{min-height:100vh;background:var(--vic-bg);font-family:var(--font-read);font-size:20px;color:var(--vic-text-primary)}
   .wrap,main{max-width:1100px;margin:0 auto;padding:0 20px}
   main{padding-bottom:64px}
   .pad{padding:40px}
   .top{display:flex;gap:20px;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;margin:18px 0 14px}
   .kicker{font-family:var(--font-mono);text-transform:uppercase;font-size:15px;letter-spacing:.04em;color:var(--vic-primary);margin:0}
   h1{font-family:var(--font-read);font-size:clamp(32px,4.6vw,46px);margin:2px 0 6px;line-height:1.1}
   .where{margin:0;color:var(--vic-text-secondary);font-size:19px;max-width:62ch}
   .pickroom{display:flex;flex-direction:column;gap:4px;font-size:16px;color:var(--vic-text-secondary)}
   .pickroom select{font-family:var(--font-read);font-size:18px;padding:10px 12px;border-radius:12px;border:2px solid var(--vic-field-border);background:var(--vic-surface);color:var(--vic-text-primary)}

   .warn{margin:0 0 14px;padding:14px 16px;border-radius:14px;background:var(--vic-warning-soft);border-left:6px solid var(--vic-warning);font-size:17px}
   .warn code{font-family:var(--font-mono);font-size:15px}
   .placebar{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:0 0 14px;padding:14px 16px;border-radius:14px;background:var(--vic-ink);color:var(--vic-ink-text);font-size:17px}
   .placebar a{color:#fff;font-weight:700}
   .coords{font-family:var(--font-mono);background:var(--vic-ink-2);padding:6px 12px;border-radius:999px;font-size:17px}

   .frame{position:relative;overflow:hidden;height:clamp(300px,52vh,560px);border-radius:22px;border:3px solid var(--vic-ink-line);background:var(--vic-ink);cursor:grab;touch-action:pan-y;user-select:none}
   .frame:active{cursor:grabbing}
   .frame.placing{cursor:crosshair}
   .frame:focus-visible{outline:4px solid var(--vic-cyan);outline-offset:3px}
   .track{position:absolute;inset:0 auto 0 0;height:100%;will-change:transform}
   .track img{position:absolute;top:0;height:100%;max-width:none;display:block;pointer-events:none}

   .overlay{position:absolute;inset:0;display:flex;flex-direction:column;gap:8px;align-items:center;justify-content:center;margin:0;padding:24px;text-align:center;color:var(--vic-ink-text);background:var(--vic-ink);z-index:3}
   .overlay.bad{color:#fff}
   .overlay p{margin:0}
   .overlay .sm{font-size:16px;color:var(--vic-ink-muted);max-width:52ch}
   .overlay a{color:var(--vic-vic-glow)}

   /* Markers carry a number AND a word, never colour alone. */
   .prop{position:absolute;transform:translate(-50%,-50%);display:flex;align-items:center;gap:8px;background:transparent;border:0;padding:4px;cursor:pointer;z-index:2}
   .dot{display:grid;place-items:center;width:38px;height:38px;border-radius:999px;background:var(--vic-ink);color:#fff;border:3px solid #fff;font-family:var(--font-mono);font-size:17px;font-weight:700;box-shadow:0 6px 18px rgba(0,0,0,.45);flex:none}
   .tag{font-size:16px;font-weight:700;color:#fff;background:rgba(10,19,48,.82);padding:5px 11px;border-radius:999px;white-space:nowrap;border:1px solid rgba(255,255,255,.35)}
   .prop.on .dot{background:var(--vic-primary);transform:scale(1.12)}
   .prop.on .tag{background:var(--vic-primary)}
   .prop:focus-visible .dot{outline:4px solid var(--vic-cyan);outline-offset:3px}

   .hint{position:absolute;right:14px;bottom:10px;margin:0;font-family:var(--font-mono);font-size:14px;color:var(--vic-ink-muted);background:rgba(10,19,48,.6);padding:5px 10px;border-radius:999px;z-index:2}
   .credit{margin:10px 0 0;font-size:16px;color:var(--vic-text-muted)}

   .panel{margin:20px 0 0;background:var(--vic-surface);border:3px solid var(--vic-primary);border-radius:22px;padding:24px;box-shadow:var(--vic-shadow-card)}
   .phead{display:flex;gap:16px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}
   .panel h2{font-family:var(--font-read);font-size:clamp(24px,3.2vw,32px);margin:0;line-height:1.15}
   .pbtns{display:flex;gap:10px;flex:none}
   .note{margin:12px 0 0;font-size:21px;max-width:60ch}
   .tl{font-family:var(--font-mono);text-transform:uppercase;font-size:14px;letter-spacing:.04em;color:var(--vic-primary);margin:20px 0 6px}
   .teaches{margin:0;padding-left:22px}
   .teaches li{margin:4px 0}

   .spk,.close{font-family:var(--font-read);font-size:17px;font-weight:700;min-height:48px;padding:10px 16px;border-radius:14px;cursor:pointer;border:2px solid var(--vic-field-border);background:var(--vic-surface);color:var(--vic-text-primary)}
   .spk[aria-pressed='true']{background:var(--vic-primary);border-color:var(--vic-primary);color:#fff}
   .spk.inline{min-height:36px;padding:2px 10px;margin-left:8px;font-size:15px;vertical-align:middle;border-radius:999px}

   .list{display:flex;flex-wrap:wrap;gap:10px;list-style:none;margin:22px 0 0;padding:0;counter-reset:none}
   .list button{display:inline-flex;align-items:center;gap:9px;font-family:var(--font-read);font-size:17px;font-weight:700;min-height:48px;padding:10px 16px;border-radius:999px;border:2px solid var(--vic-border);background:var(--vic-surface);color:var(--vic-text-primary);cursor:pointer}
   .list button.on{background:var(--vic-ink);border-color:var(--vic-ink);color:#fff}
   .list .n{display:grid;place-items:center;width:26px;height:26px;border-radius:999px;background:var(--vic-surface-muted);color:var(--vic-text-primary);font-family:var(--font-mono);font-size:14px;flex:none}
   .list button.on .n{background:var(--vic-ink-2);color:#fff}

   @media (max-width:640px){
    .room{font-size:19px}
    .tag{display:none}
    .frame{height:clamp(260px,42vh,420px)}
   }
   @media (prefers-reduced-motion:reduce){ .track{will-change:auto} .prop.on .dot{transform:none} }
  `}</style>
 </div>
}

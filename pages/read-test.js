import Head from 'next/head'
import { useEffect, useMemo, useRef, useState } from 'react'

// A ten-minute experiment, not a product screen: can the browser tell a clean read from a stumble?
// One child reads a short page aloud. We already know the words, so we only check whether each expected
// word was said, in order. Open /read-test in Chrome on a laptop, press Start, hand the child the screen.

const SAMPLE = 'The big dog ran to the red barn. A little hen sat on the hay. The sun was hot, so the dog sat down.'
const clean = w => String(w || '').toLowerCase().replace(/[^a-z']/g, '')

// Walks the words the browser heard against the words we expect. Returns one status per expected word:
// 'ok' (heard in order), 'skip' (the child went past it), or '' (not reached yet).
function align(expected, heard) {
 const status = expected.map(() => '')
 let i = 0
 for (const raw of heard) {
  const w = clean(raw)
  if (!w || i >= expected.length) continue
  if (w === expected[i]) { status[i] = 'ok'; i++ }
  else if (expected[i + 1] && w === expected[i + 1]) { status[i] = 'skip'; status[i + 1] = 'ok'; i += 2 }
  else if (expected[i + 2] && w === expected[i + 2]) { status[i] = 'skip'; status[i + 1] = 'skip'; status[i + 2] = 'ok'; i += 3 }
 }
 return { status, next: i }
}

export default function ReadTest() {
 const [text, setText] = useState(SAMPLE)
 const [listening, setListening] = useState(false)
 const [supported, setSupported] = useState(true)
 const [finalText, setFinalText] = useState('')
 const [interim, setInterim] = useState('')
 const [log, setLog] = useState([])
 const [error, setError] = useState('')
 const rec = useRef(null)
 const finals = useRef('')

 const words = useMemo(() => text.trim().split(/\s+/).filter(Boolean), [text])
 const expected = useMemo(() => words.map(clean), [words])
 const heardWords = useMemo(() => `${finalText} ${interim}`.trim().split(/\s+/).filter(Boolean), [finalText, interim])
 const { status, next } = useMemo(() => align(expected, heardWords), [expected, heardWords])
 const okCount = status.filter(s => s === 'ok').length
 const skipCount = status.filter(s => s === 'skip').length

 useEffect(() => { setSupported(Boolean(typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition))) }, [])
 useEffect(() => () => { try { rec.current?.abort() } catch {} }, [])

 function start() {
  setError('')
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!Rec) { setSupported(false); return }
  finals.current = ''; setFinalText(''); setInterim(''); setLog([])
  const r = new Rec()
  r.lang = 'en-US'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 3
  r.onresult = e => {
   let interimNow = ''
   for (let i = e.resultIndex; i < e.results.length; i++) {
    const res = e.results[i], best = res[0]
    if (res.isFinal) {
     finals.current += ` ${best.transcript}`
     setFinalText(finals.current.trim())
     setLog(l => [...l, { heard: best.transcript.trim(), confidence: best.confidence, alts: Array.from(res).slice(1).map(a => a.transcript.trim()) }])
    } else interimNow += ` ${best.transcript}`
   }
   setInterim(interimNow.trim())
  }
  r.onerror = e => setError(e.error === 'not-allowed' ? 'The browser needs microphone permission. Click the lock icon by the address bar and allow the microphone.' : `The browser reported: ${e.error}`)
  r.onend = () => setListening(false)
  rec.current = r
  try { r.start(); setListening(true) } catch (e) { setError(e.message) }
 }
 function stop() { try { rec.current?.stop() } catch {} setListening(false) }

 return <main>
  <Head><title>Reading test | AskVic</title><meta name="robots" content="noindex" /></Head>
  <h1>Can the browser hear a child read?</h1>
  <p className="lead">Use Chrome on a laptop. Paste a page the child can mostly read, press <strong>Start</strong>, and let them read it aloud. Green = heard in order. Orange = skipped. Then look at what the browser <em>actually</em> heard below.</p>

  {!supported && <p className="bad">This browser has no speech recognition. Open this page in Chrome or Edge.</p>}

  <label className="box">The page to read (edit freely)
   <textarea rows={3} value={text} disabled={listening} onChange={e => setText(e.target.value)} />
  </label>

  <div className="row">
   {!listening ? <button type="button" className="go" disabled={!supported || !words.length} onClick={start}>Start listening</button>
    : <button type="button" className="stop" onClick={stop}>Stop</button>}
   <span className={listening ? 'live on' : 'live'}>{listening ? '● Listening…' : 'Not listening'}</span>
   <span className="score">{okCount} of {words.length} words heard in order{skipCount ? ` · ${skipCount} skipped` : ''}</span>
  </div>
  {error && <p className="bad" role="alert">{error}</p>}

  <section className="page" aria-label="The page being read">
   {words.map((w, i) => <span key={i} className={`w ${status[i]}${i === next && listening ? ' now' : ''}`}>{w} </span>)}
  </section>

  <section className="heard">
   <h2>What the browser heard</h2>
   <p className="raw">{`${finalText} ${interim}`.trim() || 'Nothing yet.'}</p>
   {log.length > 0 && <table>
    <thead><tr><th>Heard</th><th>Confidence</th><th>Other guesses</th></tr></thead>
    <tbody>{log.map((l, i) => <tr key={i}><td>{l.heard}</td><td>{l.confidence ? `${Math.round(l.confidence * 100)}%` : '—'}</td><td>{l.alts.join(' · ') || '—'}</td></tr>)}</tbody>
   </table>}
  </section>

  <section className="how">
   <h2>How to judge it</h2>
   <ul>
    <li>Have the child read it <strong>cleanly</strong> once, then <strong>deliberately skip or mangle</strong> a word. Does the page show the difference?</li>
    <li>If clean reads come out mostly green and a stumble shows orange, listening works and this is the most valuable thing on the roadmap.</li>
    <li>If it turns a seven-year-old into gibberish, we learned that in ten minutes instead of a month.</li>
    <li>Try a quiet room, then the real classroom noise. Write down the grade of the child and what you saw.</li>
   </ul>
  </section>

  <style jsx>{`
   main{max-width:900px;margin:0 auto;padding:24px 20px 64px;font-family:var(--font-read,system-ui);color:var(--vic-text-primary,#1b2236)}
   h1{font-size:clamp(28px,4vw,40px);margin:8px 0}
   h2{font-size:22px;margin:0 0 8px}
   .lead{font-size:18px;line-height:1.6}
   .box{display:flex;flex-direction:column;gap:6px;font-weight:700;margin:18px 0}
   textarea{font:inherit;font-size:19px;padding:12px;border:2px solid #9aa6c4;border-radius:12px;font-weight:400}
   .row{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin:8px 0 18px}
   button{min-height:56px;padding:12px 28px;border-radius:14px;border:0;font-size:20px;font-weight:800;cursor:pointer;font-family:inherit}
   .go{background:#134fd1;color:#fff}.stop{background:#b42318;color:#fff}
   button:disabled{opacity:.5;cursor:not-allowed}
   .live{font-weight:700;color:#5b6477}.live.on{color:#b42318}
   .score{font-weight:800;font-size:18px}
   .page{background:#fff;border:3px solid #134fd1;border-radius:18px;padding:26px 28px;font-size:clamp(28px,4.4vw,42px);line-height:1.7}
   .w{border-radius:8px;padding:0 4px;transition:background .15s}
   .w.ok{background:#c9f0d2}
   .w.skip{background:#ffd9a8}
   .w.now{outline:3px solid #134fd1}
   .heard{margin-top:26px}
   .raw{font-size:20px;background:#eef1f8;border-radius:12px;padding:14px 16px;min-height:28px}
   table{border-collapse:collapse;width:100%;margin-top:10px;font-size:16px}
   th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #d5dbea}
   .bad{background:#fde8e6;color:#8b1a10;padding:12px 16px;border-radius:12px;font-weight:700}
   .how{margin-top:26px;background:#f4f6fb;border-radius:14px;padding:18px 22px}
   .how li{margin:8px 0;line-height:1.55;font-size:17px}
  `}</style>
 </main>
}

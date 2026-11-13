import Head from 'next/head'
import {useEffect,useRef,useState} from 'react'
import {supabase} from '../lib/supabase'
import {BUCKET,sniffVideoType,RECORDING_FORMATS} from '../lib/hiring-media.mjs'

// The candidate's screening interview. Invitation only, nobody signed in, reached with the code
// from their email.
//
// Two things this screen must never do. It must not lose a recording: the take stays in memory and
// on the page until the upload is confirmed, and a failed upload leaves the clip there to retry
// rather than clearing it. And it must not make the candidate feel watched or sold to -- there is
// no advertising on this page, no account to create, and nothing about the software it runs on.

// How small a recording can be and still do its job.
//
// A panel scores what a candidate says, never how they look saying it -- that rule is on the scoring
// sheet, so paying for 720p is paying for the one thing nobody is allowed to mark. 480p at this
// bitrate is a perfectly clear talking head.
//
// Audio is the exception and is deliberately not cut: the whole answer lives in the words, and a
// scorer straining to hear a candidate will mark them down for it whatever the rubric says.
//
// Measured at roughly 9.7 MB a minute before this change and about a third of that after, which is
// also a third of the upload -- and the candidate on weak home Wi-Fi at ten at night is the one who
// most needs this to finish.
const VIDEO_WIDTH=640
const VIDEO_HEIGHT=480
const VIDEO_BITS=450_000
const AUDIO_BITS=96_000

const RESUME_TYPES={pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}
const mins=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`

async function api(body){
 const r=await fetch('/api/hiring/screening',{method:body?'POST':'GET',credentials:'same-origin',...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})}).catch(()=>{throw Object.assign(new Error('Lost your connection. Nothing you recorded or wrote is lost on this page; check your Wi-Fi and try again.'),{offline:true})})
 const d=await r.json().catch(()=>({}))
 if(!r.ok)throw Object.assign(new Error(d.error||'Something went wrong. Please try again, or call the school office.'),{status:r.status})
 return d
}

// What a recording actually is, read out of its own first bytes.
//
// A browser may accept a request to record WebM and hand back something else, and MediaRecorder's
// own mimeType is only its word for it. Believing either one mislabels the file in storage, and a
// panel member is then served a file whose content type contradicts its contents: a black player,
// a duration of zero, and a candidate who looks like they submitted nothing.
async function sniffType(blob,fallback){
 try{return sniffVideoType(new Uint8Array(await blob.slice(0,12).arrayBuffer()),fallback)}
 catch{return fallback}
}

function pickMime(){
 if(typeof MediaRecorder==='undefined')return ''
 for(const t of RECORDING_FORMATS)if(MediaRecorder.isTypeSupported(t))return t
 return ''
}

function Recorder({question,limit,onDone,busy,answered,savedSeconds}){
 // Starts in 'saved' when this answer is already in, so coming back to the page shows what is
 // actually true rather than an empty camera button next to an answer that is already recorded.
 const [stream,setStream]=useState(null),[state,setState]=useState(answered?'saved':'idle'),[clip,setClip]=useState(null),[seconds,setSeconds]=useState(savedSeconds||0),[error,setError]=useState('')
 const [clipUrl,setClipUrl]=useState('')
 const video=useRef(null),recorder=useRef(null),chunks=useRef([]),timer=useRef(null)

 useEffect(()=>()=>{stream?.getTracks().forEach(t=>t.stop());clearInterval(timer.current)},[stream])
 useEffect(()=>{if(video.current&&stream&&state!=='done')video.current.srcObject=stream},[stream,state])

 // The playback URL is made once per take and released after, rather than in render: a URL built
 // during render is rebuilt on every keystroke elsewhere on the page and never freed.
 useEffect(()=>{
  if(!clip?.blob?.size){setClipUrl('');return}
  const url=URL.createObjectURL(clip.blob)
  setClipUrl(url)
  return ()=>URL.revokeObjectURL(url)
 },[clip])

 async function camera(){
  setError('')
  try{
   const s=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:VIDEO_WIDTH},height:{ideal:VIDEO_HEIGHT}},audio:true})
   setStream(s);setState('ready')
  }catch{setError('We could not reach your camera or microphone. Check your browser’s permission prompt, or call the office and we will arrange an interview without recording.')}
 }

 function start(){
  const mime=pickMime()
  if(!mime){setError('This browser cannot record video. Try Chrome, Edge, Firefox or Safari — or call the office for an interview without recording.');return}
  chunks.current=[]
  const rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:VIDEO_BITS,audioBitsPerSecond:AUDIO_BITS})
  rec.ondataavailable=e=>{if(e.data?.size)chunks.current.push(e.data)}
  rec.onstop=async()=>{
   clearInterval(timer.current)
   // rec.mimeType is what the recorder says it produced, which beats what we asked for; the bytes
   // themselves beat both.
   const claimed=String(rec.mimeType||mime).split(';')[0]
   const parts=chunks.current.slice()
   const type=await sniffType(new Blob(parts),claimed)
   const blob=new Blob(parts,{type})
   // The live preview and the playback are two different elements, but React will happily reuse one
   // DOM node for both -- and a node still holding srcObject ignores src, so playback would be a
   // blank, silent player. Detach the camera from the node before the swap.
   if(video.current){try{video.current.pause()}catch{};video.current.srcObject=null}
   stream.getTracks().forEach(t=>t.stop())
   if(!blob.size){
    // Back to idle, not 'ready': the camera tracks are stopped now, so "Start recording" would run
    // against a dead stream. Turning the camera on again is the only honest next step.
    setError('Nothing came through on that recording. Check that your browser is allowed to use the microphone and camera, then turn the camera on and try again.')
    setStream(null)
    setState('idle')
    return
   }
   setClip({blob,type})
   setState('done')
  }
  recorder.current=rec
  rec.start(1000)
  setSeconds(0);setState('recording')
  timer.current=setInterval(()=>setSeconds(s=>{if(s+1>=limit){try{rec.stop()}catch{}return limit}return s+1}),1000)
 }

 const stop=()=>{try{recorder.current?.stop()}catch{}}
 const again=()=>{setError('');setClip(null);setSeconds(0);setStream(null);setState('idle')}

 // The take is only called saved once the server has confirmed it. On failure the clip stays exactly
 // where it is so the candidate presses the same button again rather than recording the answer twice.
 const use=async()=>{
  const saved=await onDone(clip,seconds)
  if(!saved)return
  setClip(null)
  setState('saved')
 }

 return <div className="rec">
  {/* Distinct keys so React builds a fresh element for playback instead of handing the playback
      props to the node that was just showing the camera. */}
  {state==='saved'
   ?<div className="saved" role="status">
     <p className="savedline"><span aria-hidden="true">✓</span> This answer is saved{seconds?` · ${mins(seconds)}`:''}</p>
     <p className="muted">Nothing more to do here. You can record it again if you want to replace it.</p>
    </div>
   :state==='done'&&clipUrl
   ?<video key="playback" controls playsInline src={clipUrl} className="shot"
     onError={()=>setError('This browser recorded your answer but will not play it back here. You can still send it — press “Use this take” — or record it again if you would rather see it first.')}/>
   :<video key="preview" ref={video} autoPlay muted playsInline className="shot"/>}

  {state==='saved'&&<button type="button" disabled={!!busy} onClick={again}>Record this answer again</button>}
  {answered&&state!=='saved'&&<p className="muted">Your saved answer is still there. It is only replaced when you press “Use this take”.</p>}
  {state==='idle'&&<button type="button" className="primary" onClick={camera}>Turn on camera</button>}
  {state==='ready'&&<button type="button" className="primary" onClick={start}>Start recording</button>}
  {state==='recording'&&<div className="live">
   <span className="dot" aria-hidden="true"/><strong>Recording · {mins(seconds)}</strong>
   <span className="muted">stops automatically at {mins(limit)}</span>
   <button type="button" onClick={stop}>Stop</button>
  </div>}
  {state==='done'&&<div className="row">
   <button type="button" className="primary" disabled={!!busy} onClick={use}>{busy||'Use this take'}</button>
   <button type="button" disabled={!!busy} onClick={again}>Record it again</button>
   <span className="muted">{mins(seconds)}</span>
  </div>}
  {error&&<p className="bad" role="alert">{error}</p>}
  <style jsx>{`
   .rec{display:grid;gap:12px}
   .shot{width:100%;max-height:360px;background:var(--vic-ink);border-radius:14px}
   .row,.live{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
   .dot{width:12px;height:12px;border-radius:50%;background:var(--vic-danger);display:inline-block}
   .muted{color:var(--vic-text-muted);font-size:15px}
   /* Colorblind-safe: the tick, the word and the border carry it, never colour alone. */
   .saved{border:2px solid var(--vic-ink);border-radius:14px;padding:16px 18px;background:var(--vic-primary-soft)}
   .savedline{margin:0;font-size:19px;font-weight:800;display:flex;gap:10px;align-items:center}
   .saved .muted{margin:6px 0 0}
   .bad{background:var(--vic-danger-soft);color:var(--vic-danger);padding:10px 12px;border-radius:10px;margin:0}
   button{padding:12px 16px;border-radius:12px;border:1px solid var(--vic-field-border);background:var(--vic-surface);font-weight:700}
   .linkish{padding:0;border:0;background:none;color:var(--vic-link,var(--vic-primary));text-decoration:underline;font-weight:600;cursor:pointer}
   .primary{background:var(--vic-primary);border-color:var(--vic-primary);color:#fff}
  `}</style>
 </div>
}

export default function HiringScreening(){
 const [ready,setReady]=useState(false),[session,setSession]=useState(false),[data,setData]=useState(null)
 const [code,setCode]=useState(''),[commute,setCommute]=useState(''),[consent,setConsent]=useState(false)
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const [drafts,setDrafts]=useState({}),[submitted,setSubmitted]=useState('')

 useEffect(()=>{api().then(d=>{setSession(!!d.session);if(d.session){setData(d);if(d.candidate?.submitted)setSubmitted(d.candidate.name||'Candidate')}}).catch(()=>{}).finally(()=>setReady(true))},[])

 const run=async(label,fn)=>{setBusy(label);setError('');setNotice('');try{await fn();return true}catch(e){setError(e.message);return false}finally{setBusy('')}}

 const enter=e=>{e.preventDefault();run('Opening your interview…',async()=>{const d=await api({action:'enter',code});setSession(true);setData(d)})}
 const agree=e=>{e.preventDefault();run('Saving…',async()=>{const d=await api({action:'consent',consent:true,commute});setData(d);setNotice('Thank you. You can start with question one whenever you are ready.')})}

 // The clip is handed over only after the server confirms it. If any step fails the take is still
 // on the page, so the candidate retries rather than re-records.
 const useTake=(question)=>async(clip,seconds)=>
  run('Uploading…',async()=>{
   const prep=await api({action:'upload-url',kind:`q${question.ordinal}`,contentType:clip.type,bytes:clip.blob.size})
   const up=await supabase.storage.from(BUCKET).uploadToSignedUrl(prep.path,prep.token,clip.blob,{contentType:prep.contentType})
   if(up.error)throw new Error('The upload did not finish. Check your connection and press “Use this take” again — your recording is still here.')
   const d=await api({action:'file',kind:`q${question.ordinal}`,path:prep.path,questionId:question.id,seconds})
   setData(d);setNotice(`Video ${question.ordinal} is saved.`)
  })

 // Browsers sometimes report no type for a Word file, so the extension decides when the type is blank.
 const attachResume=file=>{if(!file)return
  run('Uploading your resume…',async()=>{
   const ext=(file.name.split('.').pop()||'').toLowerCase()
   const type=RESUME_TYPES[ext]
   if(!type)throw new Error('Attach your resume as a PDF or Word document.')
   const prep=await api({action:'upload-url',kind:'resume',contentType:type,bytes:file.size})
   const up=await supabase.storage.from(BUCKET).uploadToSignedUrl(prep.path,prep.token,file,{contentType:prep.contentType})
   if(up.error)throw new Error('The upload did not finish. Check your connection and try attaching it again.')
   const d=await api({action:'resume',path:prep.path,fileName:file.name})
   setData(d);setNotice('Resume saved.')
  })}

 // For a shared computer: forget this session so the next person enters their own code.
 const notYou=()=>run('One moment…',async()=>{await api({action:'leave'});setSession(false);setData(null);setCode('');setCommute('');setConsent(false);setDrafts({})})
 const due=data?.candidate?.deadline?new Date(data.candidate.deadline).toLocaleString(undefined,{weekday:'long',month:'long',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):''

 const saveWritten=q=>run('Saving…',async()=>{const d=await api({action:'written',questionId:q.id,text:drafts[q.id]||''});setData(d);setNotice('Saved.')})
 const submit=()=>{if(!window.confirm('Submit your interview? You will not be able to change your answers afterwards.'))return
  run('Submitting…',async()=>{const d=await api({action:'submit'});setSubmitted(d.name||'Candidate')})}

 const videos=(data?.questions||[]).filter(q=>q.stage==='video')
 const written=(data?.questions||[]).filter(q=>q.stage==='written')
 const resumeDone=Boolean(data?.candidate?.resumeAttached)
 const left=(data?.questions||[]).filter(q=>!q.answered).length+(resumeDone?0:1)

 return <main>
  <Head><title>Teacher screening interview</title><meta name="robots" content="noindex,nofollow"/></Head>

  <header className="hero">
   <p className="eyebrow">TEACHER SCREENING INTERVIEW</p>
   <h1>Five video questions and five short written answers.</h1>
   <p>Take it at your own pace. Nothing is sent until you press submit, and you can re-record any answer as many times as you like.</p>
  </header>

  {!ready?<p role="status">Opening your interview…</p>
  :submitted?<section className="card">
   <h2>Your interview is in. Thank you.</h2>
   <p>We have your five video answers and your written responses, {submitted}. Our team reviews every complete packet, and you will hear from us by email or phone within two weeks of the closing date — either way. If anything needs correcting, call the office.</p>
  </section>
  :!session?<section className="card">
   <h2>Enter your invitation code</h2>
   <p className="muted">It is the twelve-character code in your invitation email, and it works on one device at a time.</p>
   <form onSubmit={enter} className="row">
    <input value={code} onChange={e=>setCode(e.target.value)} placeholder="ABCD-EFGH-JKLM" aria-label="Invitation code" autoComplete="off" spellCheck="false"/>
    <button className="primary" disabled={!!busy}>{busy||'Open my interview'}</button>
   </form>
   <p className="muted">Having trouble, or would you prefer an interview that does not involve recording? Call the school office and we will arrange one.</p>
  </section>
  :!data?.candidate?.consented?<section className="card">
   <h2>Before you begin</h2>
   <p className="muted">Signed in as {data?.candidate?.name||'this candidate'}. <button type="button" className="linkish" onClick={notYou} disabled={!!busy}>Not you? Use a different code</button></p>
   <p className="notice">{data?.notice}</p>
   <form onSubmit={agree} className="stack">
    <label>Have you reviewed our school hours and your daily commute, and is it sustainable for you long term?
     <textarea rows={3} value={commute} onChange={e=>setCommute(e.target.value)} placeholder="Your own answer — this is not scored."/>
    </label>
    <label className="check"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> I have read the notice above and I am ready to record.</label>
    <button className="primary" disabled={!consent||!!busy}>{busy||'Start my interview'}</button>
   </form>
  </section>
  :<>
   <p className="muted">Signed in as {data.candidate.name||'this candidate'}. <button type="button" className="linkish" onClick={notYou} disabled={!!busy}>Not you? Use a different code</button></p>
   {due&&<p className="muted">Please submit by <strong>{due}</strong>. After that this invitation stops working.</p>}
   <p className="progress" role="status">{left===0?'All answers saved. Submit when you are ready.':`${left} ${left===1?'answer':'answers'} still to do.`}</p>

   <section className="card">
    <p className="eyebrow">RESUME{resumeDone?' · SAVED':''}</p>
    <h2>Attach your resume</h2>
    <p className="muted">A PDF or Word document, up to 10 MB.</p>
    {resumeDone&&<p className="done"><span aria-hidden="true">✓</span> Saved: {data.candidate.resumeName}. Choose a different file below to replace it.</p>}
    <input type="file" accept=".pdf,.doc,.docx,application/pdf" aria-label="Choose your resume" disabled={!!busy} onChange={e=>{attachResume(e.target.files?.[0]);e.target.value=''}}/>
   </section>

   {videos.map(q=><section className="card" key={q.id}>
    <p className="eyebrow">VIDEO {q.ordinal} OF {videos.length}{q.answered?' · SAVED':''}</p>
    <h2>{q.prompt}</h2>
    <p className="muted">Up to {mins(data.limits.videoSeconds)}. Tell us about real children and real classrooms — a story beats a textbook answer every time.</p>
    <Recorder key={q.id} question={q} limit={data.limits.videoSeconds} onDone={useTake(q)} busy={busy} answered={q.answered} savedSeconds={q.seconds}/>
   </section>)}

   {written.map(q=><section className="card" key={q.id}>
    <p className="eyebrow">WRITTEN {q.ordinal} OF {written.length}{q.answered?' · SAVED':''}</p>
    <h2>{q.prompt}</h2>
    <p className="muted">A single paragraph. We read for what you say and how well you write it, so give it a proofread.</p>
    <textarea rows={6} value={drafts[q.id]??q.text??''} onChange={e=>setDrafts(d=>({...d,[q.id]:e.target.value}))} placeholder="Your answer"/>
    <div className="row">
     <button type="button" className="primary" disabled={!!busy} onClick={()=>saveWritten(q)}>{busy||(q.answered?'Save changes':'Save this answer')}</button>
     {q.answered&&<span className="done"><span aria-hidden="true">✓</span> Saved{q.words?` · ${q.words} words`:''}</span>}
    </div>
   </section>)}

   <section className="card">
    <h2>Submit your interview</h2>
    <p className="muted">{left===0?'Everything is saved. Once you submit, your answers are final.':'Finish every question above first.'}</p>
    <button type="button" className="primary" disabled={left>0||!!busy} onClick={submit}>{busy||'Submit my interview'}</button>
   </section>
  </>}

  {error&&<p className="bad" role="alert">{error}</p>}
  {notice&&<p className="ok" role="status">{notice}</p>}

  <style jsx>{`
   main{max-width:780px;margin:0 auto;padding:24px 18px 64px}
   .hero{margin:8px 0 20px}
   .eyebrow{font-family:var(--font-mono);font-size:13px;letter-spacing:.08em;color:var(--vic-text-secondary);margin:0 0 6px}
   h1{font-size:30px;margin:0 0 8px}
   h2{font-size:21px;margin:0 0 8px;line-height:1.35}
   .card{background:var(--vic-surface);border:1px solid var(--vic-border-soft);border-radius:18px;padding:20px;margin:0 0 18px;box-shadow:var(--vic-shadow-soft)}
   .stack{display:grid;gap:14px}
   .row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px}
   .muted{color:var(--vic-text-secondary);font-size:15px}
   .notice{background:var(--vic-accent-soft);padding:14px;border-radius:12px;line-height:1.55}
   .progress{font-weight:700;padding:12px 14px;background:var(--vic-surface-muted);border-radius:12px}
   /* Colorblind-safe: the tick and the word carry the meaning, not the color. */
   .done{display:inline-flex;gap:8px;align-items:center;font-weight:700;color:var(--vic-text-primary)}
   .ok{background:var(--vic-primary-soft);padding:12px 14px;border-radius:12px;font-weight:600}
   .bad{background:var(--vic-danger-soft);color:var(--vic-danger);padding:12px 14px;border-radius:12px;font-weight:600}
   label{display:grid;gap:6px;font-weight:600}
   .check{display:flex;gap:10px;align-items:flex-start;font-weight:600}
   input,textarea{padding:12px;border-radius:12px;border:1px solid var(--vic-field-border);background:var(--vic-surface);width:100%;font-family:var(--font-body)}
   textarea{font-family:var(--font-read);line-height:1.55}
   button{padding:12px 18px;border-radius:12px;border:1px solid var(--vic-field-border);background:var(--vic-surface);font-weight:700}
   .primary{background:var(--vic-primary);border-color:var(--vic-primary);color:#fff}
   button:disabled{background:var(--vic-disabled);border-color:var(--vic-disabled);color:#fff}
  `}</style>
 </main>
}

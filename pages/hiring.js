import Head from 'next/head'
import {useEffect,useState} from 'react'
import VICHeader from '../components/VICHeader'
import {supabase} from '../lib/supabase'

// Hiring, for the panel. Invite candidates, watch what they sent, score it against the rubric.
//
// The screen shows each question's look-fors beside the recording while you score. That is the
// whole point: the paper packet this replaces had a blank "Look for..." column, so three people on
// a panel were quietly using three different bars and nobody knew.
//
// Other panel members' numbers stay hidden until you have saved your own. A panel that can see the
// first score anchors on it, and then three scorers are one scorer wearing three hats.

async function api(body,query=''){
 const {data:{session}}=await supabase.auth.getSession()
 if(!session)throw Object.assign(new Error('Please log in.'),{login:true})
 const r=await fetch(`/api/hiring/admin${query}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${session.access_token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})
 const d=await r.json().catch(()=>({}))
 if(!r.ok)throw Object.assign(new Error(d.error||'Something went wrong. Please try again.'),{status:r.status})
 return d
}
const day=d=>d?new Date(d).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):''
const mins=s=>s?`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`:''
const STAGES=[['invited','Invited'],['screening_submitted','Screening in'],['interview','Interview'],['demo','Teaching demo'],['references','References'],['offer','Offer'],['hired','Hired'],['declined','Not advancing'],['withdrawn','Withdrew']]
const stageLabel=s=>(STAGES.find(([k])=>k===s)||[,s])[1]

function Score({item,onSave,busy}){
 const [content,setContent]=useState(item.myScore?.content??'')
 const [fit,setFit]=useState(item.myScore?.fit??'')
 const [writing,setWriting]=useState(item.myScore?.writing??'')
 const [note,setNote]=useState(item.myScore?.note??'')
 const [voice,setVoice]=useState(item.myScore?.voiceMismatch??false)
 const nums=max=>Array.from({length:max+1},(_,i)=>i)
 const scored=o=>(o.content||0)+(o.fit||0)+(o.writing||0)
 const perMax=item.maxContent+item.maxFit+item.maxWriting
 const row=(label,help,value,set,max)=>max>0&&<div className="pick" key={label}>
  <div className="picklabel"><strong>{label}</strong> <span className="of">/ {max}</span><span className="help">{help}</span></div>
  <div className="btns">{nums(max).map(n=><button key={n} type="button" aria-pressed={value===n} onClick={()=>set(n)}>{n}</button>)}</div>
 </div>
 return <div className="score">
  {row('Content','Is the answer any good? Real children, real classrooms, specifics over the textbook version.',content,setContent,item.maxContent)}
  {row('Fit','Would this answer work here? Does it match how this school teaches.',fit,setFit,item.maxFit)}
  {row('Writing','Grammar, clarity, professional tone.',writing,setWriting,item.maxWriting)}
  <label>The story they told
   <textarea rows={2} value={note} onChange={e=>setNote(e.target.value)} placeholder="The specific child, class or week they named. Six weeks from now this is the useful part."/>
  </label>
  {item.stage==='written'&&<label className="flag">
   <input type="checkbox" checked={voice} onChange={e=>setVoice(e.target.checked)}/>
   <span>This does not sound like the same person as their video — ask about it in the next round. <span className="help">A note to follow up, not a score and not an accusation. Worth nothing either way.</span></span>
  </label>}
  <button type="button" className="primary" disabled={content===''||fit===''||(item.maxWriting>0&&writing==='')||!!busy}
   onClick={()=>onSave({content:Number(content),fit:Number(fit),writing:item.maxWriting>0?Number(writing||0):0,note,voiceMismatch:voice})}>
   {busy||(item.myScore?'Update my score':'Save my score')}
  </button>
  {item.myScore&&<p className="mine">Your score on this answer: <strong>{scored(item.myScore)}</strong> / {perMax}</p>}
  {!item.myScore&&item.otherScorerCount>0&&<p className="muted">{item.otherScorerCount} other panel {item.otherScorerCount===1?'member has':'members have'} scored this. Their numbers appear once you save yours.</p>}
  {item.myScore&&item.others.map((o,i)=><p className="other" key={i}><strong>{o.name}:</strong> {scored(o)} / {perMax} <span className="muted">(content {o.content}, fit {o.fit}{item.maxWriting>0?`, writing ${o.writing}`:''})</span>{o.note?` · ${o.note}`:''}{o.voiceMismatch?' · flagged: sounds unlike their video':''}</p>)}
  <style jsx>{`
   .score{display:grid;gap:14px;padding:14px;border-radius:14px;background:var(--vic-surface-muted);margin-top:12px}
   .pick{display:grid;gap:6px}
   .picklabel{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
   .of{color:var(--vic-text-secondary);font-weight:700}
   .help{color:var(--vic-text-secondary);font-size:14px;font-weight:500;flex:1 1 100%}
   .btns{display:flex;gap:6px;flex-wrap:wrap}
   .btns button{width:44px;padding:9px 0;border-radius:10px;border:1px solid var(--vic-field-border);background:var(--vic-surface);font-weight:700}
   .btns button[aria-pressed=true]{background:var(--vic-primary);border-color:var(--vic-primary);color:#fff}
   label{display:grid;gap:6px;font-weight:600}
   .flag{display:flex;gap:10px;align-items:flex-start;font-weight:500;background:var(--vic-surface);padding:12px;border-radius:12px}
   textarea{padding:10px;border-radius:10px;border:1px solid var(--vic-field-border);font-family:var(--font-read);line-height:1.5}
   .primary{padding:11px 16px;border-radius:12px;border:0;background:var(--vic-primary);color:#fff;font-weight:700;justify-self:start}
   .primary:disabled{background:var(--vic-disabled)}
   .muted{color:var(--vic-text-secondary);font-size:14px;margin:0}
   .mine,.other{margin:0;font-size:15px}
  `}</style>
 </div>
}

export default function Hiring(){
 const [ready,setReady]=useState(false),[blocked,setBlocked]=useState('')
 const [schools,setSchools]=useState([]),[schoolId,setSchoolId]=useState(''),[data,setData]=useState(null)
 const [open,setOpen]=useState(null),[review,setReview]=useState(null)
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const [posting,setPosting]=useState({title:'',gradeBand:'',subject:''})
 const [invite,setInvite]=useState({postingId:'',name:'',email:'',phone:'',certAreas:''}),[issued,setIssued]=useState(null)

 useEffect(()=>{api().then(d=>{setSchools(d.schools);if(d.schools[0])setSchoolId(d.schools[0].id);else setBlocked('none')}).catch(e=>setBlocked(e.login?'login':e.message)).finally(()=>setReady(true))},[])
 const load=async(id=schoolId)=>{if(!id)return;try{setData(await api(null,`?schoolId=${encodeURIComponent(id)}`))}catch(e){setError(e.message)}}
 useEffect(()=>{setData(null);load(schoolId)},[schoolId])

 const run=async(label,fn)=>{setBusy(label);setError('');setNotice('');try{await fn()}catch(e){setError(e.message)}finally{setBusy('')}}

 const addPosting=e=>{e.preventDefault();run('Creating…',async()=>{
  const d=await api({action:'create-posting',schoolId,...posting})
  setPosting({title:'',gradeBand:'',subject:''});setInvite(i=>({...i,postingId:d.postingId}));await load()
  setNotice(`Position created with its own copy of all ${d.questions} rubric questions.`)})}

 const addCandidate=e=>{e.preventDefault();run('Creating the invitation…',async()=>{
  const d=await api({action:'invite',schoolId,...invite})
  setIssued({name:invite.name,code:d.code,expiresAt:d.expiresAt})
  setInvite(i=>({postingId:i.postingId,name:'',email:'',phone:'',certAreas:''}));await load()})}

 const openCandidate=async c=>{setOpen(c.id);setReview(null);setError('')
  try{setReview(await api(null,`?schoolId=${encodeURIComponent(schoolId)}&candidateId=${encodeURIComponent(c.id)}`))}catch(e){setError(e.message)}}

 const saveScore=(item)=>vals=>run('Saving…',async()=>{
  await api({action:'score',schoolId,responseId:item.responseId,...vals})
  setReview(await api(null,`?schoolId=${encodeURIComponent(schoolId)}&candidateId=${encodeURIComponent(open)}`));await load();setNotice('Your score is saved.')})

 const setStage=(c,stage)=>run('Saving…',async()=>{await api({action:'stage',schoolId,candidateId:c.id,stage});await load()})

 const postingName=id=>(data?.postings||[]).find(p=>p.id===id)?.title||''
 const link=typeof window!=='undefined'?`${window.location.origin}/hiring-screening`:'/hiring-screening'
 const copy=t=>{navigator.clipboard?.writeText(t).then(()=>setNotice('Copied.')).catch(()=>{})}

 return <main>
  <Head><title>Hiring | AskVic</title><meta name="description" content="Invite teaching candidates, review their screening interviews, and score them against a rubric your whole panel shares."/></Head>
  <VICHeader currentPath="/hiring"/>
  <div className="crumbs"><a href="/school">← School dashboard</a></div>

  <header className="hero">
   <p className="eyebrow">SCHOOL LEADERSHIP · HIRING</p>
   <h1>A teacher is a multi-million dollar decision.</h1>
   <p>Fifty grand their first year, ninety or a hundred thirty years on, plus insurance and retirement. Run it like the decision it is: everyone on the panel scores the same rubric, separately, and the numbers add up.</p>
  </header>

  {!ready?<p role="status">Opening hiring…</p>
  :blocked?<section className="card">
   <h2>{blocked==='login'?'Please log in':'Hiring is part of the school leadership workspace'}</h2>
   <p className="muted">{blocked==='login'?'Log in with your school leader account.':blocked==='none'?'Set up your school in the leadership workspace first, then come back.':blocked}</p>
   <a className="primary" href={blocked==='login'?'/login?next=/hiring':'/assistantprincipal'}>{blocked==='login'?'Log in':'Open the leadership workspace'}</a>
  </section>
  :open&&review?<>
   <button type="button" className="back" onClick={()=>{setOpen(null);setReview(null)}}>← All candidates</button>
   <section className="card">
    <h2>{review.candidate.name}</h2>
    <p className="muted">{review.candidate.email}{review.candidate.phone?` · ${review.candidate.phone}`:''}{review.candidate.certAreas?` · ${review.candidate.certAreas}`:''}</p>
    <p className="muted">Screening submitted {day(review.candidate.submittedAt)||'— not yet'} · Stage: {stageLabel(review.candidate.stage)} · Video deleted after {day(review.candidate.deleteAfter)}</p>
    {review.candidate.commuteSustainable&&<p className="quote"><strong>On the commute, in their words:</strong> {review.candidate.commuteSustainable}</p>}
    <label className="stagePick">Move to stage
     <select value={review.candidate.stage} onChange={e=>setStage(review.candidate,e.target.value)}>{STAGES.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select>
    </label>
   </section>

   {review.totals&&<section className="card">
    <h3>Results</h3>
    {!review.totals.scorers.length
     ?<p className="muted">Nobody has scored this interview yet. Scores appear here as each panel member saves theirs.</p>
     :<>
      <table className="results">
       <thead><tr><th>Scorer</th><th>Video</th><th>Written</th><th>Total</th><th>Answers scored</th></tr></thead>
       <tbody>
        {review.totals.scorers.map((r,i)=><tr key={i}>
         <td>{r.name}{r.isMe?' (you)':''}</td>
         <td>{r.video} <span className="muted">/ {review.totals.maxVideo}</span></td>
         <td>{r.written} <span className="muted">/ {review.totals.maxWritten}</span></td>
         <td><strong>{r.total}</strong> <span className="muted">/ {review.totals.maxTotal}</span></td>
         <td>{r.answersScored} <span className="muted">of {review.totals.answers}</span></td>
        </tr>)}
        {review.totals.scorers.length>1&&<tr className="panelrow">
         <td><strong>Panel combined</strong></td>
         <td><strong>{review.totals.panel.video}</strong></td>
         <td><strong>{review.totals.panel.written}</strong></td>
         <td><strong>{review.totals.panel.total}</strong> <span className="muted">/ {review.totals.maxTotal*review.totals.scorers.length}</span></td>
         <td><span className="muted">{review.totals.scorers.length} scorers</span></td>
        </tr>}
       </tbody>
      </table>
      <p className="muted">{review.totals.scorers.length===1
       ?'One scorer so far. Candidates are ranked on the panel\u2019s combined total, so a second scorer adds to this rather than averaging with it.'
       :'Candidates are ranked on the combined total. Nobody holds a veto, including the principal.'}</p>
      {review.totals.scorers.some(r=>r.answersScored<review.totals.answers)&&
       <p className="muted">Somebody has not finished. A part-scored interview reads as a lower total than it deserves \u2014 finish before you compare candidates.</p>}
     </>}
   </section>}

   {review.items.filter(i=>i.stage!=='interview').map(item=><section className="card" key={item.questionId}>
    <p className="eyebrow">{item.stage==='video'?'VIDEO':'WRITTEN'} {item.ordinal}{item.domain?` · ${item.domain.toUpperCase()}`:''}</p>
    <h3>{item.prompt}</h3>
    {!item.responseId?<p className="muted">No answer yet.</p>:<>
     {item.videoUrl&&<video controls src={item.videoUrl} className="shot"/>}
     {item.seconds?<p className="muted">{mins(item.seconds)}</p>:null}
     {item.text&&<p className="written">{item.text}</p>}
     <details open>
      <summary>What to listen for</summary>
      <p className="look"><strong>Strong sounds like:</strong> {item.lookForStrong||'—'}</p>
      <p className="look"><strong>Weak sounds like:</strong> {item.lookForWeak||'—'}</p>
     </details>
     <Score item={item} onSave={saveScore(item)} busy={busy}/>
    </>}
   </section>)}
  </>
  :<>
   {schools.length>1&&<label className="schoolPick">School<select value={schoolId} onChange={e=>setSchoolId(e.target.value)}>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}

   <section className="card">
    <h2>Candidates</h2>
    {!data?<p role="status">Loading…</p>
    :!data.candidates.length?<p className="muted">Nobody invited yet. Create a position below, then invite your first candidate.</p>
    :<table>
     <thead><tr><th>Candidate</th><th>Position</th><th>Stage</th><th>Video</th><th>Written</th><th>Panel total</th><th/></tr></thead>
     <tbody>{data.candidates.map(c=><tr key={c.id}>
      <td><strong>{c.name}</strong><br/><span className="muted">{c.email}</span></td>
      <td>{postingName(c.postingId)}</td>
      <td>{stageLabel(c.stage)}{c.submittedAt?'':' · not submitted'}</td>
      {/* An unscored candidate says so in words rather than showing a zero, which would read as a bad score. */}
      <td>{c.scorers?c.video:<span className="muted">—</span>}</td>
      <td>{c.scorers?c.written:<span className="muted">—</span>}</td>
      <td>{c.scorers?<><strong>{c.total}</strong><br/><span className="muted">{c.scorers} scorer{c.scorers===1?'':'s'}</span></>:<span className="muted">Not scored yet</span>}</td>
      <td><button type="button" onClick={()=>openCandidate(c)}>Review</button></td>
     </tr>)}</tbody>
    </table>}
   </section>

   <section className="card">
    <h2>Invite a candidate</h2>
    <p className="muted">They get a single-use code and record their interview at <code>{link}</code>. Send them the link and the code.</p>
    <form onSubmit={addCandidate} className="grid">
     <label>Position<select value={invite.postingId} onChange={e=>setInvite({...invite,postingId:e.target.value})} required><option value="">Choose…</option>{(data?.postings||[]).filter(p=>!['closed','filled'].includes(p.status)).map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
     <label>Name<input value={invite.name} onChange={e=>setInvite({...invite,name:e.target.value})} required/></label>
     <label>Email<input type="email" value={invite.email} onChange={e=>setInvite({...invite,email:e.target.value})} required/></label>
     <label>Phone<input value={invite.phone} onChange={e=>setInvite({...invite,phone:e.target.value})}/></label>
     <label>Certification areas<input value={invite.certAreas} onChange={e=>setInvite({...invite,certAreas:e.target.value})}/></label>
     <button className="primary" disabled={!!busy}>{busy||'Create invitation'}</button>
    </form>
    {issued&&<div className="issued">
     <p><strong>{issued.name}</strong>’s code, good until {day(issued.expiresAt)}:</p>
     <p className="code">{issued.code}</p>
     <button type="button" onClick={()=>copy(`${link}\n\nYour code: ${issued.code}`)}>Copy the link and code</button>
     <p className="muted">Shown once here. If it gets lost, create a new invitation.</p>
    </div>}
   </section>

   <section className="card">
    <h2>Positions</h2>
    {(data?.postings||[]).length>0&&<ul className="plain">{data.postings.map(p=><li key={p.id}><strong>{p.title}</strong> {p.gradeBand&&<span className="muted">· {p.gradeBand}</span>} {p.subject&&<span className="muted">· {p.subject}</span>} <span className="muted">· {p.status}</span></li>)}</ul>}
    <form onSubmit={addPosting} className="grid">
     <label>Title<input value={posting.title} onChange={e=>setPosting({...posting,title:e.target.value})} placeholder="Elementary Teacher" required/></label>
     <label>Grade band<input value={posting.gradeBand} onChange={e=>setPosting({...posting,gradeBand:e.target.value})} placeholder="K–2"/></label>
     <label>Subject<input value={posting.subject} onChange={e=>setPosting({...posting,subject:e.target.value})} placeholder="ELA"/></label>
     <button className="primary" disabled={!!busy}>{busy||'Create position'}</button>
    </form>
    <p className="muted">Each position gets its own copy of the rubric, so editing one never changes a rubric somebody was already scored against.</p>
   </section>
  </>}

  {error&&<p className="bad" role="alert">{error}</p>}
  {notice&&<p className="ok" role="status">{notice}</p>}

  <style jsx>{`
   main{max-width:900px;margin:0 auto;padding:16px 18px 64px}
   .crumbs{margin:8px 0}
   .hero{margin:8px 0 20px}
   .eyebrow{font-family:var(--font-mono);font-size:13px;letter-spacing:.08em;color:var(--vic-text-secondary);margin:0 0 6px}
   h1{font-size:30px;margin:0 0 8px}
   h2{font-size:21px;margin:0 0 10px}
   h3{font-size:18px;margin:0 0 10px;line-height:1.4}
   .card{background:var(--vic-surface);border:1px solid var(--vic-border-soft);border-radius:18px;padding:20px;margin:0 0 18px;box-shadow:var(--vic-shadow-soft)}
   .grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));align-items:end;margin-top:12px}
   label{display:grid;gap:6px;font-weight:600}
   input,select,textarea{padding:11px;border-radius:11px;border:1px solid var(--vic-field-border);background:var(--vic-surface);width:100%}
   button{padding:11px 16px;border-radius:12px;border:1px solid var(--vic-field-border);background:var(--vic-surface);font-weight:700}
   .primary{background:var(--vic-primary);border-color:var(--vic-primary);color:#fff}
   .primary:disabled{background:var(--vic-disabled);border-color:var(--vic-disabled)}
   .back{margin:0 0 14px}
   table{width:100%;border-collapse:collapse}
   th,td{text-align:left;padding:10px 8px;border-bottom:1px solid var(--vic-border-soft);vertical-align:top}
   th{font-size:14px;color:var(--vic-text-secondary)}
   .muted{color:var(--vic-text-secondary);font-size:15px}
   .shot{width:100%;max-height:420px;background:var(--vic-ink);border-radius:14px}
   .written{background:var(--vic-surface-muted);padding:14px;border-radius:12px;font-family:var(--font-read);line-height:1.6;white-space:pre-wrap}
   .quote{background:var(--vic-accent-soft);padding:12px;border-radius:12px}
   details{margin-top:12px;border:1px solid var(--vic-border-soft);border-radius:12px;padding:10px 12px}
   summary{font-weight:700;cursor:pointer}
   .look{margin:8px 0 0;line-height:1.55;font-size:15px}
   .issued{margin-top:14px;padding:14px;border-radius:14px;background:var(--vic-ink);color:var(--vic-ink-text)}
   .issued p{margin:0 0 8px}
   .issued .muted{color:var(--vic-ink-muted)}
   .code{font-family:var(--font-mono);font-size:24px;letter-spacing:.06em}
   .plain{list-style:none;padding:0;margin:0 0 6px;display:grid;gap:6px}
   .stagePick{margin-top:12px;max-width:260px}
   .schoolPick{max-width:320px;margin:0 0 14px}
   .ok{background:var(--vic-primary-soft);padding:12px 14px;border-radius:12px;font-weight:600}
   .bad{background:var(--vic-danger-soft);color:var(--vic-danger);padding:12px 14px;border-radius:12px;font-weight:600}
   code{font-family:var(--font-mono);font-size:14px}
   .results{margin-bottom:10px}
   .results th,.results td{padding:9px 8px}
   .panelrow td{border-top:2px solid var(--vic-border)}
  `}</style>
 </main>
}

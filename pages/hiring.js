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
 const r=await fetch(`/api/hiring/admin${query}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${session.access_token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}).catch(()=>{throw Object.assign(new Error('Lost your connection. Nothing was lost; check your Wi-Fi and try again.'),{offline:true})})
 const d=await r.json().catch(()=>({}))
 if(!r.ok)throw Object.assign(new Error(d.error||'Something went wrong. Please try again.'),{status:r.status})
 return d
}
const day=d=>d?new Date(d).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):''
const mins=s=>s?`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`:''
const STAGES=[['invited','Invited'],['screening_submitted','Screening in'],['interview','Interview'],['demo','Teaching demo'],['references','References'],['offer','Offer'],['hired','Hired'],['declined','Not advancing'],['withdrawn','Withdrew']]
const stageLabel=s=>(STAGES.find(([k])=>k===s)||[,s])[1]

// A score you can see at a glance.
//
// These were styled with styled-jsx and built inside a helper function, which is why they stayed
// unstyled squares: styled-jsx only adds its scoping class to markup written directly in the
// component, so nothing applied and a chosen number looked exactly like an unchosen one. The
// styling lives in inline styles now -- plainer, but nothing can quietly fail to reach it.
//
// A chosen number is filled dark, white, larger, and ringed. Four signals and not one of them is
// colour on its own, which matters when the person scoring is colourblind.
const DIAL_BASE = {
 width: 52, height: 52, borderRadius: '50%', padding: 0, lineHeight: 1, cursor: 'pointer',
 display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
 border: '2px solid var(--vic-border)', background: 'var(--vic-surface)',
 color: 'var(--vic-text-secondary)', fontWeight: 700, fontSize: 17, fontFamily: 'inherit',
 transition: 'transform .12s ease, background .12s ease, box-shadow .12s ease',
}
const DIAL_ON = {
 ...DIAL_BASE,
 background: 'var(--vic-ink)', borderColor: 'var(--vic-ink)', color: '#fff',
 transform: 'scale(1.12)', boxShadow: '0 0 0 4px var(--vic-primary-soft)', fontSize: 19,
}

function Dial({label,help,value,max,onPick}){
 return <div style={{display:'grid',gap:9}}>
  <div>
   <strong style={{fontSize:17}}>{label}</strong>
   <span style={{color:'var(--vic-text-muted)',fontWeight:600,marginLeft:8}}>0&ndash;{max}</span>
   {help&&<div style={{color:'var(--vic-text-secondary)',fontSize:14,fontWeight:500,marginTop:3,lineHeight:1.5}}>{help}</div>}
  </div>
  <div role="radiogroup" aria-label={`${label}, 0 to ${max}`} style={{display:'flex',gap:10,flexWrap:'wrap'}}>
   {Array.from({length:max+1},(_,n)=>
    <button key={n} type="button" role="radio" aria-checked={value===n} onClick={()=>onPick(n)}
     style={value===n?DIAL_ON:DIAL_BASE}>{n}</button>)}
  </div>
 </div>
}

function Score({item,onSave,busy}){
 const [content,setContent]=useState(item.myScore?.content??'')
 const [fit,setFit]=useState(item.myScore?.fit??'')
 const [writing,setWriting]=useState(item.myScore?.writing??'')
 const [note,setNote]=useState(item.myScore?.note??'')
 const [voice,setVoice]=useState(item.myScore?.voiceMismatch??false)
 const scored=o=>(o.content||0)+(o.fit||0)+(o.writing||0)
 const perMax=item.maxContent+item.maxFit+item.maxWriting
 return <div className="score">
  <Dial label="Content" max={item.maxContent} value={content} onPick={setContent}
   help="Is the answer any good? Real children, real classrooms, specifics over the textbook version."/>
  <Dial label="Fit" max={item.maxFit} value={fit} onPick={setFit}
   help="Would this answer work here? Does it match how this school teaches."/>
  {item.maxWriting>0&&<Dial label="Writing" max={item.maxWriting} value={writing} onPick={setWriting}
   help="Grammar, clarity, professional tone."/>}
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


// An optional round: the resume screen, the teaching demonstration, the plan and debrief. Scoring
// one is a choice. A round left alone is "we did not do this", which is a different thing from
// scoring it zero, and the packet keeps them apart.
function RoundCard({round,onSave,onClear,busy}){
 const [open,setOpen]=useState(Boolean(round.mine))
 const [points,setPoints]=useState(()=>({...(round.mine?.points||{})}))
 const [note,setNote]=useState(round.mine?.note||'')

 // Shown live as you score, so the number you are building is never a surprise at the end.
 const running=round.kind==='checklist'
  ? round.lines.reduce((a,l)=>{
     if(!points[l.key])return a
     if(!l.group)return a+l.points
     return a
    },0)+[...new Set(round.lines.filter(l=>l.group&&points[l.key]).map(l=>l.group))]
     .reduce((a,g)=>a+Math.max(...round.lines.filter(l=>l.group===g&&points[l.key]).map(l=>l.points)),0)
  : round.lines.reduce((a,l)=>a+Math.min(Number(points[l.key])||0,l.max),0)

 return <section className="card round">
  <div className="roundhead">
   <div>
    <p className="eyebrow">{round.optional?'OPTIONAL ROUND':'ROUND'}</p>
    <h3>{round.label}</h3>
    <p className="muted">{round.blurb}</p>
   </div>
   <div className="roundtotal">
    {round.mine
     ? <><strong>{round.mine.total}</strong><span className="muted"> / {round.max}</span><p className="muted">your score</p></>
     : <p className="muted">Not done</p>}
   </div>
  </div>

  {round.others.length>0&&<p className="other">{round.others.map(o=>`${o.name}: ${o.total}/${round.max}`).join(' · ')}</p>}

  {!open
   ? <button type="button" onClick={()=>setOpen(true)}>{round.mine?'Change my score':`Score the ${round.label.toLowerCase()}`}</button>
   : <div className="roundbody">
      {round.kind==='checklist'
       ? <ul className="lines">{round.lines.map(l=><li key={l.key}>
          <label><input type="checkbox" checked={!!points[l.key]} onChange={e=>setPoints(p=>({...p,[l.key]:e.target.checked}))}/>
           <span>{l.label} <span className="pts">{l.points} {l.points===1?'point':'points'}</span></span></label>
         </li>)}</ul>
       : <div className="rubric">{round.lines.map(l=><Dial key={l.key} label={l.label} help={l.look_for}
          max={l.max} value={points[l.key]===undefined?'':points[l.key]}
          onPick={n=>setPoints(p=>({...p,[l.key]:n}))}/>)}</div>}

      <label>Notes
       <textarea rows={2} value={note} onChange={e=>setNote(e.target.value)} placeholder={round.key==='demo'?'What you saw in the first two minutes, and how they answered “how do you think that went?”':'Anything worth remembering six weeks from now.'}/>
      </label>

      <p className="running">Running total: <strong>{running}</strong> / {round.max}</p>
      <div className="row">
       <button type="button" className="primary" disabled={!!busy} onClick={()=>onSave(round.key,points,note)}>{busy||'Save this round'}</button>
       <button type="button" onClick={()=>setOpen(false)}>Close</button>
       {round.mine&&<button type="button" onClick={()=>{if(window.confirm(`Clear your ${round.label.toLowerCase()} score? It will read as “we did not do this round”, not as a zero.`)){setPoints({});setNote('');onClear(round.key);setOpen(false)}}}>We did not do this round</button>}
      </div>
     </div>}

  <style jsx>{`
   .round{padding:20px}
   .roundhead{display:flex;gap:16px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap}
   .roundtotal{text-align:right;min-width:110px}
   .roundtotal strong{font-size:28px;font-family:var(--font-head)}
   .roundtotal p{margin:2px 0 0;font-size:14px}
   .eyebrow{font-family:var(--font-mono);font-size:12px;letter-spacing:.08em;color:var(--vic-text-secondary);margin:0 0 4px}
   h3{margin:0 0 4px}
   .muted{color:var(--vic-text-secondary);font-size:15px;margin:0}
   .other{margin:10px 0 0;font-size:15px}
   .roundbody{display:grid;gap:16px;margin-top:14px}
   .lines{list-style:none;padding:0;margin:0;display:grid;gap:10px}
   .lines label{display:flex;gap:10px;align-items:flex-start;font-weight:500;background:var(--vic-surface-muted);padding:11px 13px;border-radius:11px}
   .pts{color:var(--vic-text-secondary);font-size:14px;white-space:nowrap}
   .rubric{display:grid;gap:18px}
   .running{margin:0;font-size:17px}
   .running strong{font-size:22px}
   label{display:grid;gap:6px;font-weight:600}
   textarea{padding:10px;border-radius:11px;border:1px solid var(--vic-field-border);font-family:var(--font-read);line-height:1.5;width:100%}
   .row{display:flex;gap:10px;flex-wrap:wrap}
   button{padding:11px 16px;border-radius:12px;border:1px solid var(--vic-field-border);background:var(--vic-surface);font-weight:700}
   .primary{background:var(--vic-primary);border-color:var(--vic-primary);color:#fff}
  `}</style>
 </section>
}

// How far up the ladder a candidate is. Every rung is a round; a rung lights when that round has
// been scored, and the panel can decide once nothing is left waiting.
//
// Deliberately not a red-and-green stoplight. Lit and unlit are carried by fill, weight, a tick and
// a word, because colour alone is unreadable to a good share of people -- including the principal
// this was built for.
//
// A full ladder does not hire anybody. It means every round this school chose to run has been
// scored. When several candidates finish level, that is a conversation around a table and sometimes
// the superintendent -- not an arithmetic result.
function Ladder({ladder,onAdvance,onStop,onHire,onReopen,busy}){
 if(!ladder)return null
 const {segments,stopped,hired,complete,next}=ladder
 const rung=s=>{
  if(stopped)return {bg:'var(--vic-surface-muted)',color:'var(--vic-text-muted)',border:'2px dashed var(--vic-border)',mark:'\u2014',word:'stopped'}
  if(s.state==='lit')return {bg:'var(--vic-ink)',color:'#fff',border:'2px solid var(--vic-ink)',mark:'\u2713',word:'done'}
  if(s.state==='skipped')return {bg:'var(--vic-surface)',color:'var(--vic-text-muted)',border:'2px dashed var(--vic-border)',mark:'\u2013',word:'not used'}
  return {bg:'var(--vic-surface)',color:'var(--vic-text-secondary)',border:'2px solid var(--vic-border)',mark:'',word:'waiting'}
 }
 return <section className="card">
  <h3>Where they are</h3>
  <div style={{display:'flex',gap:10,flexWrap:'wrap',margin:'14px 0 6px'}}>
   {segments.map(s=>{const r=rung(s);return <div key={s.key} style={{flex:'1 1 128px',minWidth:120,padding:'13px 12px',borderRadius:14,background:r.bg,color:r.color,border:r.border}}>
    <div style={{fontSize:20,lineHeight:1,height:20,fontWeight:700}}>{r.mark}</div>
    <div style={{fontWeight:700,marginTop:7,fontSize:16}}>{s.label}</div>
    <div style={{fontSize:13,marginTop:2,opacity:.85}}>{s.state==='lit'&&!stopped?`${s.total} / ${s.max}`:r.word}</div>
   </div>})}
  </div>

  <p className="muted">
   {stopped?'Stopped. This candidate is not moving forward \u2014 their scores stay on file.'
   :hired?'Hired.'
   :complete?'Every round this school ran has been scored. Ready for a decision \u2014 if several candidates finish level, that is a table conversation, and sometimes the superintendent.'
   :`Waiting on: ${next?.label}. Score that round, or mark it as not used if you are not running it.`}
  </p>

  <div className="row">
   {stopped
    ? <button type="button" disabled={!!busy} onClick={onReopen}>{busy||'Put them back in'}</button>
    : hired
     ? <button type="button" disabled={!!busy} onClick={onReopen}>{busy||'Undo hire'}</button>
     : <>
        {complete&&<button type="button" className="primary" disabled={!!busy} onClick={onHire}>{busy||'Hire this candidate'}</button>}
        {!complete&&<button type="button" className="primary" disabled={!!busy} onClick={onAdvance}>{busy||`Move on to ${next?.label?.toLowerCase()}`}</button>}
        <button type="button" disabled={!!busy} onClick={onStop}>{busy||'Not advancing'}</button>
       </>}
  </div>
 </section>
}

export default function Hiring(){
 const [ready,setReady]=useState(false),[blocked,setBlocked]=useState('')
 const [schools,setSchools]=useState([]),[schoolId,setSchoolId]=useState(''),[data,setData]=useState(null)
 const [open,setOpen]=useState(null),[review,setReview]=useState(null)
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const [posting,setPosting]=useState({title:'',gradeBand:'',subject:''})
 const [invite,setInvite]=useState({postingId:'',name:'',email:'',phone:'',certAreas:'',hours:''}),[issued,setIssued]=useState(null)
 const [editing,setEditing]=useState(null),[tmpl,setTmpl]=useState({subject:'',body:'',hours:48})

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
  setIssued({name:invite.name,email:invite.email,code:d.code,expiresAt:d.expiresAt,emailed:d.emailed})
  setInvite(i=>({postingId:i.postingId,name:'',email:'',phone:'',certAreas:'',hours:''}));await load()})}

 const openCandidate=async c=>{setOpen(c.id);setReview(null);setError('')
  try{setReview(await api(null,`?schoolId=${encodeURIComponent(schoolId)}&candidateId=${encodeURIComponent(c.id)}`))}catch(e){setError(e.message)}}

 const saveScore=(item)=>vals=>run('Saving…',async()=>{
  await api({action:'score',schoolId,...(item.responseId?{responseId:item.responseId}:{candidateId:open,questionId:item.questionId}),...vals})
  setReview(await api(null,`?schoolId=${encodeURIComponent(schoolId)}&candidateId=${encodeURIComponent(open)}`));await load();setNotice('Your score is saved.')})

 // Refresh the open record as well as the list. Without the reload the saved stage never came
 // back into view and the control snapped to its old value, which looked exactly like a failed save.
 const setStage=(c,stage)=>run('Saving…',async()=>{
  await api({action:'stage',schoolId,candidateId:c.id,stage})
  if(open)await reload()
  await load()})

 const reload=async()=>setReview(await api(null,`?schoolId=${encodeURIComponent(schoolId)}&candidateId=${encodeURIComponent(open)}`))
 const saveRound=(round,points,note)=>run('Saving…',async()=>{
  await api({action:'round-score',schoolId,candidateId:open,round,points,note});await reload();await load();setNotice('Round saved.')})
 const clearRound=round=>run('Clearing…',async()=>{
  await api({action:'round-clear',schoolId,candidateId:open,round});await reload();await load();setNotice('Marked as not done.')})

 const editTemplate=p=>{setEditing(editing===p.id?null:p.id);setTmpl({subject:p.inviteSubject,body:p.inviteBody,hours:p.inviteHours})}
 const saveTemplate=(p,reset)=>run('Saving…',async()=>{
  await api({action:'save-invite-template',schoolId,postingId:p.id,subject:reset?'':tmpl.subject,body:reset?'':tmpl.body,hours:tmpl.hours})
  await load();setEditing(null);setNotice(reset?'That position is back on the standard email.':'Invitation email saved for this position.')})
 const extend=hours=>run('Extending…',async()=>{
  await api({action:'extend-invite',schoolId,candidateId:open,hours});await reload();await load();setNotice(`They have ${hours} more hours from now.`)})
 const preview=()=>{const v={first_name:'Dana',school:'your school',position:postingName(editing)||'the position',link:link,code:'ABCD-EFGH-JKLM',deadline:'Sunday, November 15 at 8:15 AM EST',sender:'you'}
  const fill=t=>String(t).replace(/\{([a-z_]+)\}/gi,(w,k)=>v[k]??w);return{subject:fill(tmpl.subject),body:fill(tmpl.body)}}
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
    <p className="muted">{review.candidate.resumeUrl?<a href={review.candidate.resumeUrl} target="_blank" rel="noopener noreferrer">Open résumé: {review.candidate.resumeName}</a>:'No résumé attached.'}</p>
    {!review.candidate.submittedAt&&review.candidate.inviteExpiresAt&&<p className="muted">Invitation {Date.parse(review.candidate.inviteExpiresAt)>Date.now()?'runs out':'ran out'} {new Date(review.candidate.inviteExpiresAt).toLocaleString(undefined,{weekday:'long',month:'long',day:'numeric',hour:'numeric',minute:'2-digit'})}. <button type="button" disabled={!!busy} onClick={()=>extend(24)}>Give 24 more hours</button> <button type="button" disabled={!!busy} onClick={()=>extend(48)}>Give 48 more hours</button></p>}
    {review.candidate.commuteSustainable&&<p className="quote"><strong>On the commute, in their words:</strong> {review.candidate.commuteSustainable}</p>}
    <p className="muted">Stage: {stageLabel(review.candidate.stage)}</p>
   </section>

   <Ladder ladder={review.ladder} busy={busy}
    onAdvance={()=>setStage(review.candidate,'interview')}
    onHire={()=>setStage(review.candidate,'hired')}
    onStop={()=>{if(window.confirm(`Stop ${review.candidate.name}? They will not move forward. Their scores stay on file and you can put them back in later.`))setStage(review.candidate,'declined')}}
    onReopen={()=>setStage(review.candidate,'interview')}/>

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

   {review.packet&&<section className="card">
    <h3>The packet</h3>
    <p className="muted">Every round this candidate has been through, and nothing they have not. A round you skip is left out of both sides of the total, so somebody who did four rounds is never judged against somebody who did six.</p>
    <table className="results">
     <thead><tr><th>Round</th><th>Score</th><th>Out of</th><th>Scorers</th></tr></thead>
     <tbody>
      {review.packet.rounds.map(r=><tr key={r.key} className={r.scored?'':'skipped'}>
       <td>{r.label}{r.optional&&!r.scored?' ':''}</td>
       <td>{r.scored?<strong>{r.total}</strong>:<span className="muted">{r.skipped?'not used':'not done'}</span>}</td>
       <td>{r.scored?r.max:<span className="muted">\u2014</span>}</td>
       <td>{r.scored?r.scorers:<span className="muted">\u2014</span>}</td>
      </tr>)}
      <tr className="panelrow">
       <td><strong>Packet total</strong></td>
       <td><strong>{review.packet.earned}</strong></td>
       <td><strong>{review.packet.possible}</strong></td>
       <td>{review.packet.percent===null?<span className="muted">\u2014</span>:<strong>{review.packet.percent}%</strong>}</td>
      </tr>
     </tbody>
    </table>
   </section>}

   {(review.rounds||[]).filter(r=>r.key==='screener').map(r=><RoundCard key={r.key} round={r} onSave={saveRound} onClear={clearRound} busy={busy}/>)}

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

   {review.items.some(i=>i.stage==='interview')&&<section className="card">
    <p className="eyebrow">IN-PERSON INTERVIEW</p>
    <h2>Ten questions, asked in the room</h2>
    <p className="muted">Score each answer as you hear it. Everyone on the panel scores on their own, and other members' numbers show once you save yours. The round lights on the ladder once you have scored all {review.totals.interviewQuestions}.</p>
    {(()=>{const mine=review.totals.interview.find(r=>r.isMe);return <p className="muted">{mine?`You have scored ${mine.scored} of ${review.totals.interviewQuestions}: ${mine.points} of ${review.totals.maxInterview} points so far.`:'You have not scored any yet.'}{review.totals.interview.filter(r=>!r.isMe).map(r=>` ${r.name}: ${r.scored} of ${review.totals.interviewQuestions} scored.`).join('')}</p>})()}
   </section>}
   {review.items.filter(i=>i.stage==='interview').map(item=><section className="card" key={item.questionId}>
    <p className="eyebrow">IN PERSON {item.ordinal}{item.domain?` · ${item.domain.toUpperCase()}`:''}</p>
    <h3>{item.prompt}</h3>
    <details open>
     <summary>What to listen for</summary>
     <p className="look"><strong>Strong sounds like:</strong> {item.lookForStrong||'—'}</p>
     <p className="look"><strong>Weak sounds like:</strong> {item.lookForWeak||'—'}</p>
    </details>
    <Score item={item} onSave={saveScore(item)} busy={busy}/>
   </section>)}

   {(review.rounds||[]).filter(r=>r.key!=='screener').map(r=><RoundCard key={r.key} round={r} onSave={saveRound} onClear={clearRound} busy={busy}/>)}
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
    <p className="muted">We email them a link and a single-use code to record their interview at <code>{link}</code>. The code stops working when their time to submit runs out, and the email says exactly when. Change the wording for each position under Positions below.</p>
    <form onSubmit={addCandidate} className="grid">
     <label>Position<select value={invite.postingId} onChange={e=>setInvite({...invite,postingId:e.target.value,hours:''})} required><option value="">Choose…</option>{(data?.postings||[]).filter(p=>!['closed','filled'].includes(p.status)).map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
     <label>Name<input value={invite.name} onChange={e=>setInvite({...invite,name:e.target.value})} required/></label>
     <label>Email<input type="email" value={invite.email} onChange={e=>setInvite({...invite,email:e.target.value})} required/></label>
     <label>Phone<input value={invite.phone} onChange={e=>setInvite({...invite,phone:e.target.value})}/></label>
     <label>Certification areas<input value={invite.certAreas} onChange={e=>setInvite({...invite,certAreas:e.target.value})}/></label>
     <label>Hours to submit<input type="number" min="1" max="720" value={invite.hours} onChange={e=>setInvite({...invite,hours:e.target.value})} placeholder={String((data?.postings||[]).find(x=>x.id===invite.postingId)?.inviteHours||data?.inviteHelp?.defaultHours||48)}/></label>
     <button className="primary" disabled={!!busy}>{busy||'Create invitation'}</button>
    </form>
    {issued&&<div className="issued">
     <p><strong>{issued.name}</strong>’s code, good until {day(issued.expiresAt)}:</p>
     <p className="code">{issued.code}</p>
     <button type="button" onClick={()=>copy(`${link}\n\nYour code: ${issued.code}`)}>Copy the link and code</button>
     <p className="muted">{issued.emailed==='sent'?`Emailed to ${issued.email} with the link. Replies go to you.`:issued.emailed==='failed'?'The email did not go out. Copy the link and code above and send it yourself.':'Email is not set up here, so nothing was sent. Copy the link and code above and send it yourself.'} The code is shown once; if it gets lost, create a new invitation.</p>
    </div>}
   </section>

   <section className="card">
    <h2>Positions</h2>
    {(data?.postings||[]).length>0&&<ul className="plain">{data.postings.map(p=><li key={p.id}>
     <strong>{p.title}</strong> {p.gradeBand&&<span className="muted">· {p.gradeBand}</span>} {p.subject&&<span className="muted">· {p.subject}</span>} <span className="muted">· {p.status} · {p.inviteHours} hours to submit{p.inviteCustom?' · custom email':''}</span>{' '}
     <button type="button" onClick={()=>editTemplate(p)}>{editing===p.id?'Close':'Edit invitation email'}</button>
     {editing===p.id&&<div className="tmpl">
      <label>Subject<input value={tmpl.subject} onChange={e=>setTmpl({...tmpl,subject:e.target.value})}/></label>
      <label>Message<textarea rows={16} value={tmpl.body} onChange={e=>setTmpl({...tmpl,body:e.target.value})}/></label>
      <label>Hours to submit (also how long the code works)<input type="number" min="1" max="720" value={tmpl.hours} onChange={e=>setTmpl({...tmpl,hours:Number(e.target.value)})}/></label>
      <p className="muted">Fill-ins you can use, typed exactly as shown: {(data?.inviteHelp?.placeholders||[]).map(([k,d])=>`${k} (${d})`).join(' · ')}. The message must include {'{link}'}, {'{code}'} and {'{deadline}'}.</p>
      <details open><summary>What the candidate will see</summary>
       <p><strong>{preview().subject}</strong></p>
       <p className="written">{preview().body}</p>
      </details>
      <div className="rowbtn">
       <button type="button" className="primary" disabled={!!busy} onClick={()=>saveTemplate(p,false)}>{busy||'Save for this position'}</button>
       <button type="button" disabled={!!busy} onClick={()=>{if(window.confirm('Put this position back on the standard email? Your wording for it will be replaced.'))saveTemplate(p,true)}}>Use the standard email</button>
      </div>
     </div>}
    </li>)}</ul>}
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
   .tmpl{display:grid;gap:12px;margin:12px 0 4px;padding:14px;border:1px solid var(--vic-border-soft);border-radius:14px}
   .rowbtn{display:flex;gap:10px;flex-wrap:wrap}
   .plain{list-style:none;padding:0;margin:0 0 6px;display:grid;gap:6px}
   .stagePick{margin-top:12px;max-width:260px}
   .schoolPick{max-width:320px;margin:0 0 14px}
   .ok{background:var(--vic-primary-soft);padding:12px 14px;border-radius:12px;font-weight:600}
   .bad{background:var(--vic-danger-soft);color:var(--vic-danger);padding:12px 14px;border-radius:12px;font-weight:600}
   code{font-family:var(--font-mono);font-size:14px}
   .results{margin-bottom:10px}
   .results th,.results td{padding:9px 8px}
   .panelrow td{border-top:2px solid var(--vic-border)}
   .skipped td{color:var(--vic-text-muted)}
  `}</style>
 </main>
}

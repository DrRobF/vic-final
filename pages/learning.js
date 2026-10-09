import Head from 'next/head'
import {useEffect,useState} from 'react'
import {useRouter} from 'next/router'
import VICHeader from '../components/VICHeader'
import {supabase} from '../lib/supabase'
import {youtubeId} from '../lib/learning-path.mjs'

const STARTERS=['Smooth classroom transitions','Small-group reading instruction','Exit tickets that actually inform tomorrow','Engaging reluctant readers','Differentiating a math lesson','Positive phone calls home','Questioning strategies that make students think','Supporting students after a hard morning']
const STEPS=['Learn','Watch & read','Quiz','Try it','Reflect']

async function api(body,query=''){
 const {data:{session}}=await supabase.auth.getSession()
 if(!session)throw new Error('Please log in to use Learning Paths.')
 const r=await fetch(`/api/educator/learning-paths${query}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${session.access_token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})
 const d=await r.json().catch(()=>({}))
 if(!r.ok)throw new Error(d.error||'Something went wrong. Please try again.')
 return d
}

export default function Learning(){
 const router=useRouter()
 const [ready,setReady]=useState(false),[session,setSession]=useState(null),[items,setItems]=useState([]),[item,setItem]=useState(null)
 const [topic,setTopic]=useState(''),[context,setContext]=useState(''),[busy,setBusy]=useState(''),[error,setError]=useState('')
 const [answers,setAnswers]=useState([]),[reflection,setReflection]=useState(''),[name,setName]=useState('')
 const id=Array.isArray(router.query.id)?router.query.id[0]:router.query.id

 useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSession(data.session);setReady(true)})},[])
 useEffect(()=>{if(!session)return;setError('');if(id){setItem(null);api(null,`?id=${encodeURIComponent(id)}`).then(d=>{setItem(d.item);setAnswers(d.item.quizAnswers||[]);setReflection(d.item.reflection||'')}).catch(e=>setError(e.message))}else{setItem(null);api().then(d=>setItems(d.items)).catch(e=>setError(e.message))}},[session,id])
 // Fetch real videos and articles once, right after a path is created.
 useEffect(()=>{if(item&&!item.resources.length&&!item.progress?.searched&&busy==='')findResources()},[item?.id])

 async function run(label,fn){setBusy(label);setError('');try{await fn()}catch(e){setError(e.message)}finally{setBusy('')}}
 const create=e=>{e.preventDefault();run('VIC is building your path…',async()=>{const d=await api({action:'create',topic,context});setItem(d.item);setAnswers([]);setReflection('');router.push(`/learning?id=${d.item.id}`,undefined,{shallow:true})})}
 const findResources=()=>run('Finding real videos and articles, and checking every link…',async()=>{const d=await api({action:'resources',id:item.id});const next=d.item;if(!next.resources.length){const p=await api({action:'progress',id:item.id,progress:{...next.progress,searched:true}});setItem(p.item)}else setItem(next)})
 const toggleDone=url=>run('',async()=>{const progress={...item.progress,[url]:!item.progress?.[url]};if(!progress[url])delete progress[url];const d=await api({action:'progress',id:item.id,progress});setItem(d.item)})
 const submitQuiz=()=>run('Checking your answers…',async()=>{const d=await api({action:'quiz',id:item.id,answers});setItem(d.item)})
 const finish=()=>run('Saving…',async()=>{const d=await api({action:'complete',id:item.id,reflection});setItem(d.item)})
 const remove=()=>{if(!window.confirm('Delete this learning path?'))return;run('Deleting…',async()=>{await api({action:'delete',id:item.id});router.push('/learning')})}

 const p=item?.path,quizDone=!!item?.quizAnswers,doneCount=item?Object.keys(item.progress||{}).filter(k=>k!=='searched').length:0
 const step=!item?0:item.status==='completed'?5:quizDone?3:doneCount>0?2:1

 return <main aria-busy={!!busy}><Head><title>Learning Paths | Ask VIC</title><meta name="description" content="Pick any teaching topic. VIC builds a 20–30 minute learning path with a clear overview, real videos and articles, a quick quiz, and one thing to try this week."/></Head><VICHeader currentPath="/educatorassistant"/>
  <div className="crumbs"><a href="/educatorassistant">← Educator Assistant</a>{id&&<a href="/learning">All my learning paths</a>}</div>
  {!ready?<p role="status">Opening Learning Paths…</p>:!session?<section className="card intro"><p className="eyebrow">LEARNING PATHS</p><h1>Professional learning you actually choose.</h1><p>Pick any teaching topic. VIC builds a 20–30 minute path: a clear overview, real videos and articles, a quick quiz, and one thing to try this week.</p><a className="primary" href="/login?next=/learning">Educator log in</a> <a className="outline" href="/signup">Sign up — it’s free</a></section>:<>
  {error&&<p className="error" role="alert">{error}</p>}
  {busy&&<p className="working" role="status"><span className="spinner" aria-hidden="true"/>{busy}</p>}
  {!id?<>
   <header className="hero"><p className="eyebrow">LEARNING PATHS</p><h1>What do you want to get better at?</h1><p>Pick a topic. In about half a minute VIC builds a short path just for you: a plain-English overview, real videos and articles (every link checked), a 5-question quiz, one thing to try this week, and a certificate when you finish.</p></header>
   <form className="card start" onSubmit={create}>
    <label htmlFor="topic">Your topic</label>
    <input id="topic" value={topic} onChange={e=>setTopic(e.target.value)} maxLength="200" required minLength="3" placeholder="e.g. Smooth classroom transitions" disabled={!!busy}/>
    <div className="chips">{STARTERS.map(s=><button type="button" key={s} onClick={()=>setTopic(s)} disabled={!!busy}>{s}</button>)}</div>
    <label htmlFor="context">Your classroom (optional)</label>
    <input id="context" value={context} onChange={e=>setContext(e.target.value)} maxLength="600" placeholder="e.g. 3rd grade, 22 students, two English learners" disabled={!!busy}/>
    <button className="primary" disabled={!!busy||topic.trim().length<3}>Build my learning path</button>
   </form>
   {items.length>0&&<section className="card"><h2>My learning paths</h2><ul className="list">{items.map(i=><li key={i.id}><a href={`/learning?id=${i.id}`}><strong>{i.title}</strong><span>{i.status==='completed'?`✓ Completed ${new Date(i.completedAt).toLocaleDateString()} · ${i.minutes} min`:`In progress · ${new Date(i.updatedAt).toLocaleDateString()}`}</span></a></li>)}</ul></section>}
  </>:!item?(!error&&<p role="status">Opening your path…</p>):<>
   <header className="hero"><p className="eyebrow">LEARNING PATH · ABOUT {p.minutes} MINUTES</p><h1>{p.title}</h1></header>
   <ol className="steps" aria-label="Your progress">{STEPS.map((s,i)=><li key={s} className={i<step?'done':i===step?'now':''}>{i<step?'✓ ':''}{s}</li>)}</ol>

   <section className="card"><p className="eyebrow">1 · LEARN</p><h2>The big idea</h2>{p.overview.split(/\n{2,}/).map((para,i)=><p key={i} className="body">{para}</p>)}{p.keyIdeas?.length>0&&<><h3>Key takeaways</h3><ul className="ideas">{p.keyIdeas.map((k,i)=><li key={i}>{k}</li>)}</ul></>}</section>

   <section className="card"><p className="eyebrow">2 · WATCH &amp; READ</p><h2>Go deeper</h2>
    {item.resources.length?<><p className="muted">Check off each one as you finish it. Every link was checked when this path was built.</p><div className="resources">{item.resources.map(r=>{const vid=youtubeId(r.url);return <article key={r.url} className={item.progress?.[r.url]?'res seen':'res'}>
     {vid?<div className="video"><iframe src={`https://www.youtube-nocookie.com/embed/${vid}`} title={r.title} loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture" allowFullScreen/></div>:<p className="tag">ARTICLE · {r.source}</p>}
     <h3><a href={r.url} target="_blank" rel="noopener noreferrer">{r.title} ↗</a></h3>{vid&&<p className="tag">VIDEO · {r.source}</p>}<p className="muted">{r.why}</p>
     <label className="check"><input type="checkbox" checked={!!item.progress?.[r.url]} disabled={!!busy} onChange={()=>toggleDone(r.url)}/>I {vid?'watched':'read'} this</label>
    </article>})}</div></>:<p className="muted">{busy?'Searching…':'VIC couldn’t find links it could verify for this topic right now.'} {!busy&&<button className="textButton" onClick={findResources}>Try finding resources again</button>}</p>}
   </section>

   <section className="card"><p className="eyebrow">3 · QUIZ</p><h2>Check your understanding</h2><p className="muted">Five quick questions from the overview above.</p>
    {p.quiz.map((q,qi)=><fieldset key={qi} className="q"><legend>{qi+1}. {q.question}</legend>{q.choices.map((c,ci)=>{const picked=answers[qi]===ci,right=quizDone&&q.answer===ci,wrong=quizDone&&picked&&q.answer!==ci;return <label key={ci} className={`choice${right?' right':''}${wrong?' wrong':''}`}><input type="radio" name={`q${qi}`} checked={picked} disabled={quizDone||!!busy} onChange={()=>{const next=[...answers];next[qi]=ci;setAnswers(next)}}/>{c}{right?' ✓':''}</label>})}{quizDone&&q.why&&<p className="why">{q.why}</p>}</fieldset>)}
    {quizDone?<p className="score">You scored <strong>{item.quizScore}%</strong>. {item.quizScore>=80?'Nice work.':'Review the explanations above, then keep going.'}</p>:<button className="primary" disabled={!!busy||p.quiz.some((_,i)=>!Number.isInteger(answers[i]))} onClick={submitQuiz}>Check my answers</button>}
   </section>

   <section className="card"><p className="eyebrow">4 · TRY IT THIS WEEK</p><h2>One small step</h2><p className="body">{p.tryIt}</p></section>

   <section className="card"><p className="eyebrow">5 · REFLECT</p><h2>{item.status==='completed'?'Your reflection':'Finish with a short reflection'}</h2>
    {item.status!=='completed'&&<ul className="ideas">{(p.reflectionPrompts||[]).map((r,i)=><li key={i}>{r}</li>)}</ul>}
    <textarea rows="6" value={reflection} onChange={e=>setReflection(e.target.value)} maxLength="4000" disabled={item.status==='completed'||!!busy} placeholder="A few sentences is plenty."/>
    <small className="muted">If your school leader assigns paths later, they will see whether you finished and your reflection, never your quiz score.</small>
    {item.status!=='completed'&&<button className="primary" disabled={!!busy||!quizDone||reflection.trim().length<20} onClick={finish}>{quizDone?'Finish my path':'Take the quiz first'}</button>}
   </section>

   {item.status==='completed'&&<section className="certificate" aria-label="Certificate of completion">
    <p className="eyebrow">CERTIFICATE OF COMPLETION</p>
    <input className="certName" value={name} onChange={e=>setName(e.target.value)} placeholder="Type your name" aria-label="Your name for the certificate"/>
    <p>completed the Ask VIC learning path</p><h2>{p.title}</h2>
    <p>{item.minutes} minutes of self-directed professional learning · {new Date(item.completedAt).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})}</p>
    <small>Self-directed learning record. Not a substitute for official continuing-education credit unless your school accepts it.</small>
    <button className="outline noPrint" onClick={()=>window.print()}>Print or save as PDF</button>
   </section>}
   <p className="noPrint"><button className="textButton" onClick={remove} disabled={!!busy}>Delete this path</button></p>
  </>}
  </>}
  <style jsx>{`main{max-width:980px;margin:auto;padding:24px;color:var(--vic-text-primary)}.crumbs{display:flex;gap:20px;margin:22px 0 4px}.crumbs a{color:var(--vic-primary);font-size:13px;font-weight:750;text-decoration:none}.hero{padding:26px 0 14px}.eyebrow{font-size:10px;font-weight:800;letter-spacing:.12em;color:var(--vic-primary);margin:0 0 12px}h1{font-size:clamp(32px,4vw,46px);line-height:1.1;letter-spacing:-.035em;margin:0 0 14px}.hero>p:last-child,.intro>p{font-size:16px;line-height:1.7;color:var(--vic-text-secondary);max-width:720px}.card{padding:28px;background:var(--vic-surface);border:1px solid var(--vic-border);border-radius:18px;margin:18px 0}h2{font-size:24px;letter-spacing:-.02em;margin:0 0 12px}h3{font-size:16px;margin:16px 0 6px}label{display:block;font-size:13px;font-weight:750;margin-top:12px}input:not([type=checkbox]):not([type=radio]),textarea{display:block;width:100%;padding:12px;border:1px solid var(--vic-border);border-radius:9px;background:white;color:var(--vic-text-primary);font:inherit;font-size:15px;line-height:1.6;margin:8px 0 12px}.chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 8px}.chips button{border:1px solid var(--vic-border);background:white;border-radius:20px;padding:7px 12px;font-size:12px;cursor:pointer;color:var(--vic-text-primary)}.primary,.outline{display:inline-block;padding:12px 18px;border-radius:9px;font-size:14px;font-weight:750;cursor:pointer;text-decoration:none;margin-top:8px}.primary{background:var(--vic-primary);color:white;border:1px solid var(--vic-primary)}.outline{background:var(--vic-surface);color:var(--vic-text-primary);border:1px solid var(--vic-border)}.textButton{background:none;border:0;color:var(--vic-primary);font-weight:700;cursor:pointer;padding:0}button:disabled{opacity:.5;cursor:not-allowed}.list{list-style:none;padding:0;margin:0}.list a{display:flex;justify-content:space-between;gap:12px;padding:14px 0;border-top:1px solid var(--vic-border-soft);text-decoration:none;color:var(--vic-text-primary)}.list span{font-size:13px;color:var(--vic-text-secondary);white-space:nowrap}.steps{display:flex;gap:8px;list-style:none;padding:0;margin:4px 0 8px;flex-wrap:wrap}.steps li{padding:8px 14px;border-radius:20px;border:1px solid var(--vic-border);font-size:13px;font-weight:700;color:var(--vic-text-secondary);background:var(--vic-surface)}.steps .done{background:var(--vic-success-soft);border-color:transparent;color:var(--vic-text-primary)}.steps .now{border-color:var(--vic-primary);color:var(--vic-primary)}.body{font-size:16px;line-height:1.75;margin:0 0 14px}.muted,small{font-size:13px;line-height:1.6;color:var(--vic-text-secondary)}small{display:block;margin:4px 0 10px}.ideas li{font-size:15px;line-height:1.6;margin:4px 0}.resources{display:grid;grid-template-columns:1fr 1fr;gap:16px}.res{border:1px solid var(--vic-border-soft);border-radius:14px;padding:14px;background:white}.res.seen{border-color:var(--vic-primary)}.res h3 a{color:var(--vic-text-primary)}.video{position:relative;padding-top:56.25%;border-radius:10px;overflow:hidden;background:#000}.video iframe{position:absolute;inset:0;width:100%;height:100%;border:0}.tag{font-size:10px;font-weight:800;letter-spacing:.08em;color:var(--vic-primary);margin:10px 0 0}.check{display:flex;gap:8px;align-items:center}.q{border:1px solid var(--vic-border-soft);border-radius:12px;padding:12px 16px;margin:12px 0}.q legend{font-weight:750;font-size:15px;line-height:1.5;padding:0 4px}.choice{display:flex;gap:10px;align-items:flex-start;font-weight:500;font-size:15px;padding:6px 8px;border-radius:8px;margin:2px 0}.choice input{margin-top:5px}.right{background:var(--vic-success-soft)}.wrong{background:var(--vic-danger-soft)}.why{font-size:13px;color:var(--vic-text-secondary);margin:6px 8px}.score{font-size:16px}.error{padding:12px;border-radius:10px;background:var(--vic-danger-soft);color:#7e301e;font-size:14px}.working{display:flex;gap:10px;align-items:center;font-size:14px;padding:12px;border-radius:10px;background:var(--vic-primary-soft)}.spinner{width:18px;height:18px;border:3px solid #ddd;border-top-color:var(--vic-primary);border-radius:50%;animation:turn .75s linear infinite}@keyframes turn{to{transform:rotate(360deg)}}.certificate{text-align:center;padding:44px 28px;margin:24px 0;border:3px double var(--vic-primary);border-radius:18px;background:white}.certificate h2{font-size:28px;margin:8px 0}.certificate p{font-size:15px;color:var(--vic-text-secondary)}.certName{text-align:center;font-size:30px!important;font-weight:800;border:0!important;border-bottom:2px solid var(--vic-border)!important;border-radius:0!important;max-width:520px;margin:10px auto!important}@media(max-width:720px){main{padding:16px}.resources{grid-template-columns:1fr}.list a{flex-direction:column}}@media print{:global(header),.crumbs,.steps,.card,.noPrint,.error,.working{display:none!important}.certificate{border:3px double #333;margin:0}}@media(prefers-reduced-motion:reduce){.spinner{animation:none}}`}</style>
 </main>
}

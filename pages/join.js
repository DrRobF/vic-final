import Head from 'next/head'
import {useEffect,useState} from 'react'
import VICHeader from '../components/VICHeader'
import {supabase} from '../lib/supabase'

async function api(body,query=''){
 const {data:{session}}=await supabase.auth.getSession()
 if(!session)throw Object.assign(new Error('Please log in first.'),{login:true})
 const r=await fetch(`/api/educator/join-school${query}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${session.access_token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})
 const d=await r.json().catch(()=>({}))
 if(!r.ok)throw new Error(d.error||'Something went wrong. Please try again.')
 return d
}

export default function Join(){
 const [ready,setReady]=useState(false),[session,setSession]=useState(null),[code,setCode]=useState(''),[school,setSchool]=useState(null),[consent,setConsent]=useState(''),[agree,setAgree]=useState(false)
 const [mine,setMine]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState('')
 useEffect(()=>{const c=new URLSearchParams(window.location.search).get('code');if(c)setCode(c.toUpperCase());supabase.auth.getSession().then(({data})=>{setSession(data.session);setReady(true);if(data.session)api().then(d=>{setMine(d.schools);setConsent(d.consent)}).catch(()=>{})})},[])
 async function check(e){e.preventDefault();setBusy(true);setError('');setSchool(null);try{const d=await api(null,`?code=${encodeURIComponent(code)}`);setSchool(d.school);setConsent(d.consent)}catch(err){setError(err.message)}finally{setBusy(false)}}
 async function join(){setBusy(true);setError('');try{const d=await api({code,agree});setDone(d.already?`You’re already part of ${d.school.name}.`:`You’ve joined ${d.school.name}.`);const m=await api();setMine(m.schools)}catch(err){setError(err.message)}finally{setBusy(false)}}
 const next=`/join${code?`?code=${encodeURIComponent(code)}`:''}`
 return <main><Head><title>Join your school | Ask VIC</title></Head><VICHeader currentPath="/educator"/>
  <header className="hero"><p className="eyebrow">JOIN YOUR SCHOOL</p><h1>Join your school on AskVic</h1><p>Your school leader gave you a code. Enter it here to join your school’s staff. You keep using everything in AskVic just as you do now.</p></header>
  {!ready?<p role="status">Opening…</p>:!session?<section className="card"><h2>Log in or sign up first</h2><p className="muted">Use the account you want your school to see. It’s free for teachers.</p><a className="primary" href={`/login?next=${encodeURIComponent(next)}`}>Educator log in</a> <a className="outline" href={`/signup?next=${encodeURIComponent(next)}`}>Sign up — it’s free</a></section>:<>
   {done?<section className="card success"><h2>{done}</h2><p className="muted">When your school leader assigns a Learning Path, it will be waiting for you at the top of your Learning Paths.</p><a className="primary" href="/learning">Go to Learning Paths</a> <a className="outline" href="/educator">Educator Dashboard</a></section>:<>
   <form className="card" onSubmit={check}><label htmlFor="code">School code</label><div className="codeRow"><input id="code" value={code} onChange={e=>{setCode(e.target.value.toUpperCase());setSchool(null)}} placeholder="SPA-4821" autoComplete="off" maxLength="12" required/><button className="primary" disabled={busy||code.trim().length<7}>Check code</button></div>{error&&<p className="error" role="alert">{error}</p>}</form>
   {school&&<section className="card"><p className="eyebrow">YOU’RE JOINING</p><h2>{school.name}</h2><p className="consent">{consent}</p><label className="check"><input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)}/>I understand and want to join {school.name}.</label><button className="primary" disabled={busy||!agree} onClick={join}>{busy?'Joining…':'Join my school'}</button></section>}
   </>}
   {mine.length>0&&<section className="card"><h2>Your schools</h2><ul>{mine.map(s=><li key={s.staffId}>{s.name}{s.joinedAt&&<span className="muted"> · joined {new Date(s.joinedAt).toLocaleDateString()}</span>}</li>)}</ul></section>}
  </>}
  <style jsx>{`main{max-width:760px;margin:auto;padding:24px;color:var(--vic-text-primary)}.hero{padding:30px 0 10px}.eyebrow{font-size:10px;font-weight:800;letter-spacing:.12em;color:var(--vic-primary);margin:0 0 10px}h1{font-size:clamp(30px,4vw,42px);letter-spacing:-.03em;margin:0 0 12px}.hero p:last-child{font-size:16px;line-height:1.7;color:var(--vic-text-secondary)}.card{padding:26px;background:var(--vic-surface);border:1px solid var(--vic-border);border-radius:18px;margin:16px 0}.success{border-color:var(--vic-primary)}h2{margin:0 0 10px;font-size:24px}label{display:block;font-size:13px;font-weight:750}.codeRow{display:flex;gap:10px;margin-top:8px}.codeRow input{flex:1;padding:12px;border:1px solid var(--vic-border);border-radius:9px;font:inherit;font-size:20px;letter-spacing:.08em;font-weight:800}.primary,.outline{display:inline-block;padding:12px 18px;border-radius:9px;font-weight:750;font-size:14px;cursor:pointer;text-decoration:none;margin-top:8px}.primary{background:var(--vic-primary);color:white;border:1px solid var(--vic-primary)}.outline{background:white;border:1px solid var(--vic-border);color:var(--vic-text-primary)}.codeRow .primary{margin:0}button:disabled{opacity:.5;cursor:not-allowed}.consent{font-size:15px;line-height:1.7;background:var(--vic-primary-soft);padding:14px;border-radius:10px}.check{display:flex;gap:10px;align-items:flex-start;font-weight:600;font-size:14px;margin:14px 0}.muted{font-size:13px;color:var(--vic-text-secondary);line-height:1.6}.error{padding:12px;border-radius:10px;background:var(--vic-danger-soft);color:#7e301e;font-size:14px;margin-top:12px}ul{padding-left:18px;line-height:1.9}`}</style>
 </main>
}

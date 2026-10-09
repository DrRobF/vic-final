import Head from 'next/head'
import {useEffect,useState} from 'react'
import {useRouter} from 'next/router'
import {supabase} from '../../lib/supabase'

// Printable walkthrough record. "Teacher copy" leaves out follow-up and private notes; "Full record" includes them.
export default function PrintWalkthrough(){
 const router=useRouter()
 const [data,setData]=useState(null),[error,setError]=useState('')
 const {schoolId,id,copy}=router.query
 const full=copy==='full'
 useEffect(()=>{if(!schoolId||!id)return;(async()=>{
  const {data:{session}}=await supabase.auth.getSession()
  if(!session){setError('Please log in to print this walkthrough.');return}
  const r=await fetch(`/api/assistantprincipal/walkthroughs?schoolId=${encodeURIComponent(schoolId)}`,{headers:{Authorization:`Bearer ${session.access_token}`}})
  const d=await r.json().catch(()=>({}))
  if(!r.ok){setError(d.error||'Could not open this walkthrough.');return}
  const w=d.walkthroughs.find(x=>x.id===id)
  if(!w){setError('That walkthrough was not found.');return}
  setData({w,school:d.school,options:d.options})
 })()},[schoolId,id])
 useEffect(()=>{if(data)setTimeout(()=>window.print(),400)},[data])

 if(error)return <main style={{padding:40,fontFamily:'Arial'}}><p>{error}</p></main>
 if(!data)return <main style={{padding:40,fontFamily:'Arial'}}><p>Preparing your printable walkthrough…</p></main>
 const {w,school,options}=data,date=new Date(w.created_at).toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'})
 return <main className="sheet"><Head><title>{`Walkthrough · ${w.teacher} · ${new Date(w.created_at).toLocaleDateString()}`}</title></Head>
  <div className="noPrint bar"><button onClick={()=>window.print()}>Print or save as PDF</button><span>{full?'Full record (includes private notes)':'Teacher copy (private notes left out)'}</span><a href={`?schoolId=${encodeURIComponent(schoolId)}&id=${encodeURIComponent(id)}&copy=${full?'teacher':'full'}`}>Switch to {full?'teacher copy':'full record'}</a></div>
  <header><h1>{school.name||'School'} – Classroom Walkthrough</h1><p className="lead">This brief walkthrough is designed to support instructional growth through timely, specific feedback. It is not a formal evaluation.</p></header>
  <table className="meta"><tbody><tr><th>Teacher</th><td>{w.teacher}</td><th>Date</th><td>{date}</td></tr><tr><th>Observer</th><td>{w.observer_name}</td><th>Subject</th><td>{w.subject||'—'}</td></tr><tr><th>Visit length</th><td colSpan="3">{w.visit_length||'—'}</td></tr></tbody></table>
  <h2>What was observed during this visit?</h2>
  <table className="grid"><thead><tr><th/>{options.ratings.map(r=><th key={r}>{r.replace(' during this visit','')}</th>)}</tr></thead><tbody>{options.lookFors.map(f=><tr key={f.key}><td>{f.label}</td>{options.ratings.map((r,i)=><td key={r} className="mark">{w.ratings?.[f.key]===i?'✔':''}</td>)}</tr>)}</tbody></table>
  <h2>Instructional strength observed</h2><p className="box">{w.strength}</p>
  <h2>Next step</h2><p className="box">{w.next_step}</p>
  {w.shared_feedback&&<><h2>Additional feedback</h2><p className="box">{w.shared_feedback}</p></>}
  {full&&<><h2>Follow-up needed</h2><p className="box">{w.follow_up||'—'}</p><h2>Private administrative notes <small>(not shared with the teacher)</small></h2><p className="box private">{w.private_notes||'—'}</p></>}
  <footer><span>Teacher signature: ______________________</span><span>Observer signature: ______________________</span></footer>
  <p className="tiny">Made with Ask VIC · askvic.ai</p>
  <style jsx global>{`body{background:#fff}`}</style>
  <style jsx>{`.sheet{max-width:820px;margin:0 auto;padding:28px;font-family:Arial,Helvetica,sans-serif;color:#111;font-size:13px}.bar{display:flex;gap:16px;align-items:center;padding:12px;margin-bottom:18px;background:#f4f1ea;border-radius:8px;flex-wrap:wrap}.bar button{padding:9px 14px;border:0;border-radius:6px;background:#8a4b2b;color:white;font-weight:700;cursor:pointer}.bar a{color:#8a4b2b;font-weight:700}h1{font-size:20px;margin:0 0 6px}.lead{margin:0 0 14px;color:#444}h2{font-size:14px;margin:18px 0 6px}h2 small{font-weight:400;color:#666}table{width:100%;border-collapse:collapse}.meta th{text-align:left;width:16%;background:#f4f4f4}.meta th,.meta td,.grid th,.grid td{border:1px solid #bbb;padding:6px 8px;vertical-align:top}.grid th{font-size:11px;background:#f4f4f4}.grid td:first-child{width:46%}.mark{text-align:center;font-size:15px}.box{border:1px solid #bbb;border-radius:4px;padding:8px 10px;min-height:38px;white-space:pre-wrap;margin:0}.private{background:#fbf6ee}footer{display:flex;justify-content:space-between;gap:20px;margin-top:34px}.tiny{font-size:10px;color:#888;margin-top:20px;text-align:center}@media print{.noPrint{display:none!important}.sheet{padding:0}@page{margin:14mm}}`}</style>
 </main>
}

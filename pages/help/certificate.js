import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

// The certificate a teacher prints after finishing the walkthrough. Deliberately a page of
// its own with nothing else on it: the browser's own print gives a clean sheet with no top
// bar, no navigation and no explaining to do.
//
// It says what the person actually did. It is not a credential and does not pretend to be.

const SKILLS = [
 'Planned a lesson with a standard and a learning objective',
 'Sent VIC’s version of a lesson to students at three levels',
 'Printed a teacher packet and worksheets by level',
 'Got students logged in with room code and picture cards',
 'Ran a VIC Room: launched work, steered VIC with notes, changed a child’s level',
 'Covered another teacher’s class and started their planned lesson',
 'Wrote home to one family and to a whole class',
]

export default function Certificate() {
 const router = useRouter()
 const [name, setName] = useState('')
 const [date, setDate] = useState('')

 useEffect(() => {
  if (!router.isReady) return
  const q = Array.isArray(router.query.name) ? router.query.name[0] : router.query.name
  setName((q || '').trim())
  setDate(new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }))
 }, [router.isReady, router.query.name])

 return (
  <main>
   <Head>
    <title>VIC certificate | AskVic</title>
    <meta name="robots" content="noindex" />
   </Head>

   <div className="controls noprint">
    <a href="/help/tutorial">← Back to the walkthrough</a>
    <button type="button" onClick={() => window.print()}>Print this</button>
   </div>

   <article className="cert">
    <header>
     <p className="eyebrow">AskVic</p>
     <h1>VIC Certified</h1>
     <p className="sub">This teacher has worked through every part of VIC, hands on.</p>
    </header>

    <p className="awarded">Awarded to</p>
    <p className="name">{name || '—'}</p>

    <ul className="skills">
     {SKILLS.map(s => <li key={s}><span aria-hidden="true">✓</span>{s}</li>)}
    </ul>

    <footer>
     <div className="sig">
      <span className="line" />
      <span className="role">Dr. Rob Furman, Principal</span>
      <span className="school">Saint Peter’s Academy</span>
     </div>
     <div className="sig">
      <span className="line" />
      <span className="role">{date}</span>
      <span className="school">Date completed</span>
     </div>
    </footer>
   </article>

   <style jsx>{`
    main{max-width:900px;margin:0 auto;padding:20px}
    .controls{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap}
    .controls a{color:var(--vic-primary,#2563eb);font-weight:700;text-decoration:none}
    .controls button{min-height:46px;padding:11px 22px;border:0;border-radius:12px;background:var(--vic-primary,#2563eb);color:#fff;font:inherit;font-weight:800;cursor:pointer}
    .cert{position:relative;background:#fff;color:#15202b;border:3px solid #10213a;border-radius:4px;padding:54px 56px 42px;display:grid;gap:18px;box-shadow:0 18px 50px rgba(16,33,58,.14)}
    .cert::after{content:'';position:absolute;inset:12px;border:1px solid #c7d0dd;border-radius:2px;pointer-events:none}
    header{text-align:center;display:grid;gap:8px}
    .eyebrow{margin:0;font-size:13px;font-weight:800;letter-spacing:.3em;text-transform:uppercase;color:#2563eb}
    h1{margin:0;font-family:var(--font-head,Georgia,serif);font-size:46px;line-height:1.05;letter-spacing:-.02em}
    .sub{margin:0;color:#5a6a7d;font-size:16px}
    .awarded{margin:14px 0 0;text-align:center;font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#5a6a7d;font-weight:800}
    .name{margin:0;text-align:center;font-family:var(--font-head,Georgia,serif);font-size:40px;line-height:1.2;border-bottom:2px solid #10213a;padding-bottom:12px;max-width:620px;margin-inline:auto;width:100%;word-break:break-word}
    .skills{list-style:none;margin:10px auto 0;padding:0;display:grid;gap:9px;max-width:620px}
    .skills li{display:flex;gap:11px;align-items:flex-start;font-size:15.5px;line-height:1.5;color:#2c3a4b}
    .skills li span{color:#2563eb;font-weight:800;flex:0 0 auto}
    footer{display:flex;justify-content:space-between;gap:40px;margin-top:22px;flex-wrap:wrap}
    .sig{flex:1 1 220px;display:grid;gap:5px}
    .line{display:block;height:1px;background:#10213a;margin-bottom:6px}
    .role{font-weight:800;font-size:15px}
    .school{font-size:13.5px;color:#5a6a7d}
    @media print{
     main{padding:0;max-width:none}
     .noprint{display:none !important}
     .cert{border-width:2px;box-shadow:none;padding:44px 48px 36px;break-inside:avoid}
     @page{size:letter portrait;margin:14mm}
    }
    @media(max-width:620px){.cert{padding:32px 24px}h1{font-size:34px}.name{font-size:30px}}
   `}</style>
  </main>
 )
}

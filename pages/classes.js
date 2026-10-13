import PageShell, { PanelStyles } from '../components/PageShell'
import VICClassroomWorkspace from '../components/VICClassroomWorkspace'
import { useAccount } from '../lib/use-account'

// My Classes: rosters, each student's level, and what VIC is teaching them.
export default function MyClasses() {
 const { account, error } = useAccount({ next: '/classes' })
 return <PageShell title="My Classes" currentPath="/classes">
  <PanelStyles />
  {error ? <p className="alert" role="alert">{error} <a href="/login">Log in</a></p> : !account ? <p role="status">Opening your classes…</p> : <>
   <header className="top">
    <div><p className="label">My classes</p><h1>Your students and VIC</h1><p className="muted">Add or remove students, set each student’s level, and see what VIC is teaching them.</p></div>
    {account.classroom && <a className="btn btn-vic" href="/askvic">Open VIC</a>}
   </header>
   {account.classroom ? <section className="panel pad"><VICClassroomWorkspace /></section>
    : <section className="dark-panel">
     <h2 className="dh">Your account isn’t linked to a school classroom yet</h2>
     <p>VIC teaches your students once your school adds you. Ask your school leader for your school’s join code.</p>
     <div className="row"><a className="btn btn-cyan" href="/join">Join with a school code</a><a className="btn btn-outline" href="mailto:drrobfurman@gmail.com?subject=VIC%20classroom%20access">Ask about access</a></div>
    </section>}
  </>}
  <style jsx>{`
   .top{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;margin-top:12px}
   h1{margin:0 0 6px;font-size:clamp(30px,3.4vw,42px);line-height:1.1}
   .pad{padding:10px}
   .dh{color:#fff;margin:0 0 6px}
   .row{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
   :global(.btn-vic){background:var(--vic-vic);color:#fff;box-shadow:0 0 0 3px rgba(167,139,250,.35)}
  `}</style>
 </PageShell>
}

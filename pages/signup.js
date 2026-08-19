import VICHeader from '../components/VICHeader'

const accessEmail = 'mailto:drrobfurman@gmail.com?subject=Ask%20VIC%20Access%20Request'

export default function RequestAccessPage() {
  return (
    <main className="page">
      <div className="shell">
        <VICHeader currentPath="/signup" />
        <section className="card">
          <p className="eyebrow">School-managed access</p>
          <h1>Request Access</h1>
          <p>
            Ask VIC teacher and student accounts are created and managed by an approved school
            administrator. Public account creation is not available.
          </p>
          <p>
            To test VIC, discuss school use, or explore a collaboration, contact Dr. Rob Furman at{' '}
            <a href={accessEmail}>drrobfurman@gmail.com</a>.
          </p>
          <div className="actions">
            <a className="primary" href={accessEmail}>Email Dr. Rob Furman</a>
            <a className="secondary" href="/login">Existing approved user? Sign in</a>
          </div>
        </section>
      </div>
      <style jsx>{`
        .page { min-height: 100vh; background: var(--vic-bg); color: var(--vic-text-primary); padding: 28px 16px; }
        .shell { max-width: 1040px; margin: 0 auto; }
        .card { max-width: 650px; margin: clamp(32px, 8vh, 84px) auto; padding: clamp(28px, 5vw, 48px); border: 1px solid var(--vic-border-soft); border-radius: 18px; background: var(--vic-surface); box-shadow: var(--vic-shadow-raised); }
        .eyebrow { color: var(--vic-primary); font-size: 13px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
        h1 { margin: 8px 0 18px; font-size: clamp(34px, 6vw, 52px); }
        p { color: var(--vic-text-secondary); font-size: 17px; line-height: 1.65; }
        a { color: var(--vic-primary); font-weight: 700; }
        .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; }
        .actions a { padding: 13px 17px; border-radius: 10px; text-decoration: none; }
        .primary { background: var(--vic-primary); color: white; }
        .secondary { border: 1px solid var(--vic-border); }
      `}</style>
    </main>
  )
}

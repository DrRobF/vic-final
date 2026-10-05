import { useEffect, useState } from 'react'
import Head from 'next/head'
import { supabase } from '../../lib/supabase'

async function request(method, demo = false) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Sign in with your administrator account, then return to this page.')
  const response = await fetch(demo ? '/api/admin/reset-demo-password' : '/api/admin/reset-staff-passwords', {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    ...(method === 'POST' ? { body: JSON.stringify({ confirm: demo ? 'reset-jake-demo' : 'reset-six-staff', password: 'spa2026' }) } : {}),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'The request failed.')
  return data
}

export default function StaffPasswords() {
  const [staff, setStaff] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [demoResult, setDemoResult] = useState(null)
  const [demoBusy, setDemoBusy] = useState(false)
  useEffect(() => { request('GET').then(data => setStaff(data.staff)).catch(error => setError(error.message)) }, [])
  async function reset() {
    setBusy(true); setError('')
    try { setResult(await request('POST')) } catch (error) { setError(error.message) } finally { setBusy(false) }
  }
  async function resetDemo() {
    setDemoBusy(true); setError('')
    try { setDemoResult(await request('POST', true)) } catch (error) { setError(error.message) } finally { setDemoBusy(false) }
  }
  return <main><Head><title>Staff password reset | Ask VIC</title></Head><section>
    <h1>Staff first-login setup</h1>
    <p>Reset these six staff accounts to <strong>spa2026</strong>. Each teacher must choose a personal password before using VIC or the Lesson Plan Designer.</p>
    <p>Your account and student passwords stay unchanged.</p>
    {!staff && !error && <p>Verifying administrator access…</p>}
    {staff && <ul>{staff.map(row => <li key={row.email}><strong>{row.name}</strong> — {row.email}</li>)}</ul>}
    {error && <p role="alert" className="error">{error} <a href="/login">Sign in</a></p>}
    {result ? <div role="status"><h2>{result.complete ? 'Staff reset complete' : 'Some accounts need another attempt'}</h2><ul>{result.results.map(row => <li key={row.name}>{row.name}: {row.status}</li>)}</ul><p>Teacher link: <a href="/login?next=/lessonplan">askvic.ai/login?next=/lessonplan</a></p>{!result.complete && <button disabled={busy} onClick={reset}>Retry failed accounts</button>}</div> : staff && <button disabled={busy} onClick={reset}>{busy ? 'Resetting six staff accounts…' : 'Reset six staff passwords to spa2026'}</button>}
    {staff && <div><h2>Jake student demo</h2><p>Reset only the existing Jake Student test account. Other student passwords stay unchanged.</p>{demoResult ? <p role="status">Ready: <strong>jake@example.com</strong> / <strong>spa2026</strong>. Use a private browser window to sign in as Jake while keeping your teacher session open.</p> : <button disabled={demoBusy || busy} onClick={resetDemo}>{demoBusy ? 'Resetting Jake…' : 'Reset Jake demo password to spa2026'}</button>}</div>}
  </section><style jsx>{`main{padding:40px 20px;max-width:850px;margin:auto}section{background:var(--vic-surface);border:1px solid var(--vic-border);padding:28px;border-radius:16px}p,li{line-height:1.6}li{margin:8px 0}button{padding:14px 18px;background:var(--vic-primary);color:white;border:0;border-radius:8px;font-weight:700;cursor:pointer}.error{color:var(--vic-danger)}button:disabled{opacity:.6}`}</style></main>
}

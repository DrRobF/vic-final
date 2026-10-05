import { useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { newPasswordError } from '../lib/password-policy.mjs'

export default function ChangePassword() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault()
    setError('')
    const validation = newPasswordError(password)
    if (validation) { setError(validation); return }
    if (password !== confirm) { setError('The passwords do not match.'); return }
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { await router.replace('/login'); return }
      const response = await fetch('/api/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ password }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not change your password. Please try again.')
      setPassword(''); setConfirm('')
      const { error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError) { await supabase.auth.signOut(); await router.replace('/login?next=/lessonplan'); return }
      await router.replace('/lessonplan')
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  return <main><Head><title>Choose your password | Ask VIC</title></Head><section>
    <h1>Choose your own password</h1>
    <p>Your school gave you a temporary password. Set a personal password before using VIC or the Lesson Plan Designer.</p>
    <form onSubmit={submit}>
      <label htmlFor="new-password">New password</label>
      <input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} disabled={busy}/>
      <label htmlFor="confirm-password">Confirm new password</label>
      <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={e => setConfirm(e.target.value)} disabled={busy}/>
      <small>Use at least 8 characters. Choose a password you do not share with anyone else.</small>
      {error && <p role="alert" className="error">{error}</p>}
      <button disabled={busy}>{busy ? 'Saving…' : 'Save password and open Lesson Designer'}</button>
    </form>
    <button className="signout" disabled={busy} onClick={async () => { await supabase.auth.signOut(); await router.replace('/login') }}>Sign out</button>
  </section><style jsx>{`main{min-height:100vh;display:grid;place-items:center;padding:24px}section{max-width:480px;width:100%;background:var(--vic-surface);padding:32px;border:1px solid var(--vic-border);border-radius:16px}h1{margin-top:0}p,small{line-height:1.5}form{display:grid;gap:12px}input,button{padding:12px;border-radius:8px;border:1px solid var(--vic-border)}button{cursor:pointer;background:var(--vic-primary);color:white;font-weight:700}.signout{background:transparent;color:var(--vic-primary);margin-top:18px}.error{color:var(--vic-danger)}button:disabled{opacity:.6}`}</style></main>
}

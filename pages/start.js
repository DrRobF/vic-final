import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { homeFor, rememberLeader } from '../lib/view-mode'

// After any login: send each person to their own home (school leaders → School, teachers → My Week, students → Today).
export default function Start() {
 const [error, setError] = useState('')
 useEffect(() => {
  (async () => {
   const { data: { session } } = await supabase.auth.getSession()
   if (!session) { window.location.replace('/login'); return }
   const { data: rows } = await supabase.from('users').select('role').eq('auth_user_id', session.user.id).order('id', { ascending: true }).limit(1)
   if (rows?.[0]?.role === 'student') { window.location.replace('/learn'); return }
   const r = await fetch('/api/educator/account', { headers: { Authorization: `Bearer ${session.access_token}` } })
   const d = await r.json().catch(() => ({}))
   if (!r.ok) { setError(d.error || 'Could not open your account.'); return }
   rememberLeader(d)
   window.location.replace(homeFor(d))
  })().catch(e => setError(e.message))
 }, [])
 return <main style={{ padding: '48px 20px', textAlign: 'center', fontSize: 18 }}>{error ? <p role="alert">{error} <a href="/login">Log in again</a></p> : <p role="status">Opening AskVic…</p>}</main>
}

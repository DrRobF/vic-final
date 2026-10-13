import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { rememberLeader } from './view-mode'

// Who is signed in and what they can open. Sends signed-out visitors to the right login.
export function useAccount({ loginPath = '/login', next } = {}) {
 const [account, setAccount] = useState(null), [error, setError] = useState('')
 useEffect(() => {
  let active = true
  ;(async () => {
   const { data: { session } } = await supabase.auth.getSession()
   if (!session) { window.location.replace(`${loginPath}?next=${encodeURIComponent(next || window.location.pathname + window.location.search)}`); return }
   const r = await fetch('/api/educator/account', { headers: { Authorization: `Bearer ${session.access_token}` } })
   const d = await r.json().catch(() => ({}))
   if (!active) return
   if (!r.ok) setError(d.error || 'Could not open your account.')
   else { rememberLeader(d); setAccount(d) }
  })().catch(e => { if (active) setError(e.message) })
  return () => { active = false }
 }, [])
 return { account, error }
}

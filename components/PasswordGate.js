import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { requiresPasswordChange } from '../lib/password-policy.mjs'

export default function PasswordGate({ children }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let active = true
    let timer
    async function check() {
      if (router.pathname === '/change-password') { if (active) setReady(true); return }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { if (active) setReady(true); return }
      const { data: { user }, error } = await supabase.auth.getUser()
      if (!active) return
      if (error || !user) { await supabase.auth.signOut(); setReady(true); return }
      if (requiresPasswordChange(user)) {
        setReady(false)
        await router.replace('/change-password')
      } else setReady(true)
    }
    setReady(false)
    check().catch(() => { if (active) setReady(false) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      clearTimeout(timer)
      timer = setTimeout(() => { check().catch(() => { if (active) setReady(false) }) }, 0)
    })
    return () => { active = false; clearTimeout(timer); subscription.unsubscribe() }
  }, [router.pathname])
  return ready ? children : <p style={{ padding: 32 }}>Checking account access…</p>
}

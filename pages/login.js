import { useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

const INVALID_ROLE_MESSAGE =
  'Your account does not have a valid role yet. Please contact your teacher or administrator.'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim() || !password) return

    setLoading(true)
    setError('')

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError) {
        setError(signInError.message || 'Unable to sign in. Please try again.')
        return
      }

      const user = data?.user
      const role = user?.app_metadata?.role || user?.user_metadata?.role

      if (role === 'teacher') {
        router.push('/teacher')
        return
      }

      if (role === 'student') {
        router.push('/student')
        return
      }

      setError(INVALID_ROLE_MESSAGE)
    } catch {
      setError('Something went wrong while signing in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: '48px auto', padding: '0 16px' }}>
      <h1>Login</h1>
      <p>Sign in with your email and password.</p>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      {error ? (
        <p style={{ color: 'crimson', marginTop: 16 }} role="alert">
          {error}
        </p>
      ) : null}
    </main>
  )
}

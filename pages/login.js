import { useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import VICHeader from '../components/VICHeader'

const INVALID_ROLE_MESSAGE =
  'Your account does not have a valid role yet in your profile. Please contact your teacher or administrator.'
const MISSING_PROFILE_MESSAGE =
  'No user profile was found for this account. Please contact your teacher or administrator.'

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
      const normalizedEmail = email.trim().toLowerCase()

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      if (signInError) {
        setError(signInError.message || 'Unable to sign in. Please try again.')
        return
      }

      const { data: userRows, error: userLookupError } = await supabase
        .from('users')
        .select('role')
        .eq('email', normalizedEmail)
        .order('id', { ascending: true })
        .limit(1)

      const userRow = userRows?.[0]
      const role = userRow?.role

      if (userLookupError) {
        setError(userLookupError.message || MISSING_PROFILE_MESSAGE)
        return
      }

      if (!userRow) {
        setError(MISSING_PROFILE_MESSAGE)
        return
      }

      if (role === 'teacher') {
        router.push('/teacher')
        return
      }

      if (role === 'student') {
        router.push('/askvic')
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
    <main className="authPage">
      <div className="authShell">
        <VICHeader currentPath="/login" />
        <section className="card">
          <h1>Log In</h1>
          <p>Sign in with your email and password.</p>

          <form onSubmit={handleSubmit} className="form">
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

          <p className="mutedLine">
            Need an account? <a href="/signup">Create one</a>
          </p>

          {error ? (
            <p className="errorText" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      </div>

      <style jsx>{`
        .authPage {
          min-height: 100vh;
          background: radial-gradient(circle at 0% 0%, rgba(96, 117, 255, 0.14), transparent 28%), #07070d;
          color: #fff;
          padding: 24px 16px;
        }
        .authShell {
          max-width: 920px;
          margin: 0 auto;
        }
        .card {
          max-width: 480px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 16px;
          background: rgba(17, 19, 32, 0.9);
          padding: 22px;
        }
        .form {
          display: grid;
          gap: 10px;
        }
        label {
          font-size: 13px;
          opacity: 0.9;
        }
        input, button {
          font: inherit;
          border-radius: 12px;
        }
        input {
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
          padding: 10px 12px;
        }
        button {
          margin-top: 8px;
          border: 0;
          background: linear-gradient(135deg, #6675ff 0%, #7a60ff 58%, #4f7cff 100%);
          color: #fff;
          font-weight: 700;
          padding: 11px 14px;
          cursor: pointer;
        }
        .mutedLine {
          margin-top: 14px;
          opacity: 0.9;
        }
        a { color: #9cb3ff; }
        .errorText {
          color: #ff9ca8;
          margin-top: 14px;
        }
      `}</style>
    </main>
  )
}

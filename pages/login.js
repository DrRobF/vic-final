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
          <p className="subText">Sign in with your email and password.</p>

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

            <button className="primaryButton" type="submit" disabled={loading}>
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
          background: linear-gradient(180deg, var(--vic-bg) 0%, #e9f0f9 100%);
          color: var(--vic-text-primary);
          padding: 34px 16px;
        }
        .authShell {
          max-width: 1040px;
          margin: 0 auto;
        }
        .card {
          max-width: 520px;
          border: 1px solid var(--vic-border-soft);
          border-radius: 14px;
          background: var(--vic-surface);
          padding: 36px 34px;
          box-shadow: var(--vic-shadow-raised);
        }
        h1 {
          margin: 0;
          font-size: 38px;
          line-height: 1.08;
          font-weight: 850;
        }
        .subText {
          margin: 12px 0 0;
          font-size: 16px;
          color: var(--vic-text-secondary);
        }
        .form {
          display: grid;
          gap: 10px;
          margin-top: 28px;
        }
        label {
          font-size: 13px;
          color: var(--vic-text-primary);
          margin-top: 8px;
          font-weight: 600;
        }
        input,
        button {
          font: inherit;
          border-radius: 10px;
        }
        input {
          border: 1px solid var(--vic-border-soft);
          background: #f8fbff;
          color: var(--vic-text-primary);
          padding: 11px 13px;
        }
        .primaryButton {
          margin-top: 16px;
          border: 1px solid rgba(37, 99, 235, 0.45);
          background: linear-gradient(135deg, var(--vic-primary) 0%, var(--vic-primary-hover) 58%, var(--vic-primary) 100%);
          color: var(--vic-surface);
          font-weight: 700;
          letter-spacing: 0.01em;
          padding: 13px 16px;
          border-radius: 10px;
          cursor: pointer;
          box-shadow: 0 10px 20px rgba(37, 99, 235, 0.22);
          transition: transform 0.12s ease, filter 0.12s ease;
        }
        .primaryButton:hover {
          filter: brightness(1.06);
        }
        .primaryButton:active {
          transform: translateY(1px);
        }
        .primaryButton:disabled {
          opacity: 0.78;
          cursor: not-allowed;
          box-shadow: none;
        }
        .mutedLine {
          margin: 22px 0 0;
          color: var(--vic-text-secondary);
        }
        a {
          color: var(--vic-primary);
        }
        a:hover {
          color: var(--vic-primary-hover);
        }
        .errorText {
          color: var(--vic-danger);
          margin-top: 14px;
          line-height: 1.45;
        }
      `}</style>
    </main>
  )
}

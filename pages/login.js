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
        <section className="contentWrap">
          <div className="introBlock">
            <h1>Log in to connect your learning experience</h1>
            <p className="subText">
              Access your classroom, teacher assignments, and saved progress.
            </p>
          </div>

          <div className="card">
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

              <p className="mutedLine">
                Need an account? <a href="/signup">Create one</a>
              </p>

              <button className="primaryButton" type="submit" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <p className="exploreLine">
              Just exploring? You can use VIC without logging in.
            </p>

            {error ? (
              <p className="errorText" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <style jsx>{`
        .authPage {
          min-height: 100vh;
          background: var(--vic-bg);
          color: var(--vic-text-primary);
          padding: 28px 16px 52px;
        }
        .authShell {
          max-width: 1040px;
          margin: 0 auto;
          min-height: calc(100vh - 96px);
          display: flex;
          flex-direction: column;
        }
        .contentWrap {
          width: min(100%, 460px);
          margin: 0 auto;
          padding: clamp(26px, 7vh, 72px) 14px 22px;
          border-radius: 18px;
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.68) 0%,
            rgba(255, 255, 255, 0.52) 100%
          );
          border: 1px solid rgba(157, 167, 191, 0.16);
        }
        .introBlock {
          margin-bottom: 10px;
          text-align: center;
        }
        .card {
          width: 100%;
          border: 1px solid var(--vic-border-soft);
          border-radius: 14px;
          background: var(--vic-surface);
          padding: 28px 24px;
          box-shadow: var(--vic-shadow-raised);
        }
        h1 {
          margin: 0;
          font-size: clamp(28px, 4vw, 36px);
          line-height: 1.14;
          font-weight: 800;
          letter-spacing: -0.01em;
        }
        .subText {
          margin: 8px 0 0;
          font-size: 16px;
          color: var(--vic-text-secondary);
          line-height: 1.45;
        }
        .form {
          display: grid;
          gap: 10px;
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
          background: var(--vic-surface-muted);
          color: var(--vic-text-primary);
          padding: 11px 13px;
        }
        .primaryButton {
          margin-top: 12px;
          border: 1px solid rgba(181, 83, 47, 0.48);
          background: var(--vic-primary);
          color: var(--vic-surface);
          font-weight: 700;
          letter-spacing: 0.01em;
          padding: 13px 16px;
          border-radius: 10px;
          cursor: pointer;
          box-shadow: 0 10px 20px rgba(181, 83, 47, 0.2);
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
          margin: 4px 0 2px;
          color: var(--vic-text-secondary);
          font-size: 14px;
        }
        .exploreLine {
          margin: 14px 0 0;
          color: var(--vic-text-secondary);
          font-size: 13px;
          line-height: 1.4;
        }
        a {
          color: var(--vic-primary);
          font-weight: 600;
          text-underline-offset: 2px;
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

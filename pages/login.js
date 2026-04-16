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
          background: radial-gradient(circle at 0% 0%, rgba(96, 117, 255, 0.14), transparent 28%), #07070d;
          color: #fff;
          padding: 28px 16px;
        }
        .authShell {
          max-width: 920px;
          margin: 0 auto;
        }
        .card {
          max-width: 500px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 18px;
          background: rgba(17, 19, 32, 0.9);
          padding: 28px;
          box-shadow: 0 14px 34px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.03);
        }
        h1 {
          margin: 0;
          font-size: 30px;
          line-height: 1.15;
          font-weight: 800;
        }
        .subText {
          margin: 10px 0 0;
          font-size: 15px;
          color: rgba(234, 239, 255, 0.78);
        }
        .form {
          display: grid;
          gap: 12px;
          margin-top: 22px;
        }
        label {
          font-size: 13px;
          color: rgba(234, 239, 255, 0.95);
          margin-top: 4px;
        }
        input,
        button {
          font: inherit;
          border-radius: 12px;
        }
        input {
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.06);
          color: #fff;
          padding: 12px 14px;
        }
        .primaryButton {
          margin-top: 10px;
          border: 1px solid rgba(154, 171, 255, 0.48);
          background: linear-gradient(135deg, #6675ff 0%, #7a60ff 58%, #4f7cff 100%);
          color: #fff;
          font-weight: 700;
          letter-spacing: 0.01em;
          padding: 12px 16px;
          cursor: pointer;
          box-shadow: 0 0 20px rgba(102, 117, 255, 0.25);
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
          margin: 18px 0 0;
          color: rgba(234, 239, 255, 0.82);
        }
        a {
          color: #9cb3ff;
        }
        a:hover {
          color: #bdd0ff;
        }
        .errorText {
          color: #ff9ca8;
          margin-top: 14px;
          line-height: 1.45;
        }
      `}</style>
    </main>
  )
}

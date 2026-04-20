import { useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import VICHeader from '../components/VICHeader'

const ROLE_TEACHER = 'teacher'
const ROLE_STUDENT = 'student'

export default function SignupPage() {
  const router = useRouter()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(ROLE_STUDENT)
  const [classCode, setClassCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const showClassCode = useMemo(() => role === ROLE_STUDENT, [role])

  async function rollbackUserProfile(userProfileId) {
    if (!userProfileId) return

    await supabase.from('users').delete().eq('id', userProfileId)
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const normalizedEmail = email.trim().toLowerCase()
    const normalizedName = fullName.trim()
    const normalizedClassCode = classCode.trim().toUpperCase()

    if (!normalizedName || !normalizedEmail || !password) {
      setError('Full name, email, and password are required.')
      return
    }

    if (showClassCode && !normalizedClassCode) {
      setError('Class code is required for student signup.')
      return
    }

    setLoading(true)
    setError('')

    let createdProfileId = null

    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      })

      if (signUpError) {
        const signUpMessage = signUpError.message || 'Could not create account.'
        const duplicateEmail = signUpMessage.toLowerCase().includes('already registered')

        setError(duplicateEmail ? 'That email is already registered.' : `Auth signup failed: ${signUpMessage}`)
        return
      }

      const authUser = signUpData?.user
      const createdAuthUserId = authUser?.id || ''
      const likelyDuplicate = Array.isArray(authUser?.identities) && authUser.identities.length === 0

      if (!createdAuthUserId || likelyDuplicate) {
        setError('That email is already registered.')
        return
      }

      let matchedClass = null

      if (role === ROLE_STUDENT) {
        const validationResponse = await fetch('/api/validate-class-code', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ classCode: normalizedClassCode }),
        })

        const validationBody = await validationResponse.json().catch(() => ({}))

        if (!validationResponse.ok) {
          const invalidClassCode = validationResponse.status === 404 || validationResponse.status === 400
          setError(
            invalidClassCode
              ? 'Invalid class code. Please check your class code and try again.'
              : `Class lookup failed: ${validationBody.error || 'Could not find class.'}`
          )
          return
        }

        matchedClass = { id: validationBody.id }
      }

      const { data: insertedUser, error: userInsertError } = await supabase
        .from('users')
        .insert({
          auth_user_id: createdAuthUserId,
          email: normalizedEmail,
          name: normalizedName,
          role,
        })
        .select()
        .single()

      if (userInsertError || !insertedUser?.id) {
        setError(`Profile creation failed: ${userInsertError?.message || 'Could not create user profile.'}`)
        return
      }

      createdProfileId = insertedUser.id

      if (role === ROLE_TEACHER) {
        router.push('/teacher')
        return
      }

      const { error: enrollmentError } = await supabase.from('enrollments').insert({
        student_id: insertedUser.id,
        class_id: matchedClass.id,
        support_level: 'on_level',
      })

      if (enrollmentError) {
        await rollbackUserProfile(createdProfileId)
        createdProfileId = null
        setError(`Enrollment failed: ${enrollmentError.message || 'Could not enroll in class.'}`)
        return
      }

      router.push('/askvic')
    } catch {
      if (createdProfileId) {
        await rollbackUserProfile(createdProfileId)
      }
      setError('Something went wrong during signup. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="signupPage">
      <div className="signupShell">
        <VICHeader currentPath="/signup" />
        <section className="card">
          <h1>Sign Up</h1>
          <p className="subText">Create your account and choose your role.</p>

          <form onSubmit={handleSubmit} className="form">
            <label htmlFor="full-name">Full name</label>
            <input
              id="full-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              required
            />

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
              autoComplete="new-password"
              required
              minLength={8}
            />

            <label htmlFor="role">Role</label>
            <select id="role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value={ROLE_STUDENT}>Student</option>
              <option value={ROLE_TEACHER}>Teacher</option>
            </select>

            {showClassCode ? (
              <>
                <label htmlFor="class-code">Class code</label>
                <input
                  id="class-code"
                  type="text"
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value)}
                  placeholder="Enter your class code"
                  required={showClassCode}
                />
              </>
            ) : null}

            <button className="primaryButton" type="submit" disabled={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="mutedLine">
            Already have an account? <a href="/login">Sign in</a>
          </p>

          {error ? (
            <p className="errorText" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      </div>
      <style jsx>{`
        .signupPage {
          min-height: 100vh;
          background: linear-gradient(180deg, var(--vic-bg) 0%, #e9f0f9 100%);
          color: var(--vic-text-primary);
          padding: 34px 16px;
        }
        .signupShell {
          max-width: 1040px;
          margin: 0 auto;
        }
        .card {
          max-width: 580px;
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
        select,
        button {
          font: inherit;
          border-radius: 10px;
        }
        input,
        select {
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

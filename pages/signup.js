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
          background: radial-gradient(circle at 100% 0%, rgba(108, 90, 255, 0.18), transparent 28%), #07070d;
          color: #fff;
          padding: 28px 16px;
        }
        .signupShell {
          max-width: 920px;
          margin: 0 auto;
        }
        .card {
          max-width: 560px;
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
        select,
        button {
          font: inherit;
          border-radius: 12px;
        }
        input,
        select {
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

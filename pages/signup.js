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
          <p>Create your account and choose your role.</p>

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

            <button type="submit" disabled={loading}>
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
          padding: 24px 16px;
        }
        .signupShell {
          max-width: 920px;
          margin: 0 auto;
        }
        .card {
          max-width: 540px;
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
        input, select, button {
          font: inherit;
          border-radius: 12px;
        }
        input, select {
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

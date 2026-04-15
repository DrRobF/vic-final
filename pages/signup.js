import { useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

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

  async function rollbackUserProfile(userId) {
    if (!userId) return

    await supabase.from('users').delete().eq('id', userId)
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

    let createdUserId = ''

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
      createdUserId = authUser?.id || ''
      const likelyDuplicate = Array.isArray(authUser?.identities) && authUser.identities.length === 0

      if (!createdUserId || likelyDuplicate) {
        setError('That email is already registered.')
        return
      }

      const { data: insertedUsers, error: userInsertError } = await supabase
        .from('users')
        .insert({
          id: createdUserId,
          email: normalizedEmail,
          full_name: normalizedName,
          role,
        })
        .select('id')
        .single()

      if (userInsertError || !insertedUsers?.id) {
        setError(`Profile creation failed: ${userInsertError?.message || 'Could not create user profile.'}`)
        return
      }

      if (role === ROLE_TEACHER) {
        router.push('/teacher')
        return
      }

      const { data: classRows, error: classLookupError } = await supabase
        .from('classes')
        .select('id')
        .eq('class_code', normalizedClassCode)
        .limit(1)

      const matchedClass = classRows?.[0]

      if (classLookupError) {
        await rollbackUserProfile(createdUserId)
        setError(`Class lookup failed: ${classLookupError.message || 'Could not find class.'}`)
        return
      }

      if (!matchedClass?.id) {
        await rollbackUserProfile(createdUserId)
        setError('Invalid class code. Please check your class code and try again.')
        return
      }

      const { error: enrollmentError } = await supabase.from('enrollments').insert({
        student_id: insertedUsers.id,
        class_id: matchedClass.id,
      })

      if (enrollmentError) {
        await rollbackUserProfile(createdUserId)
        setError(`Enrollment failed: ${enrollmentError.message || 'Could not enroll in class.'}`)
        return
      }

      router.push('/askvic')
    } catch {
      setError('Something went wrong during signup. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: '48px auto', padding: '0 16px' }}>
      <h1>Sign up</h1>
      <p>Create your account and choose your role.</p>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
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

      <p style={{ marginTop: 16 }}>
        Already have an account? <a href="/login">Sign in</a>
      </p>

      {error ? (
        <p style={{ color: 'crimson', marginTop: 16 }} role="alert">
          {error}
        </p>
      ) : null}
    </main>
  )
}

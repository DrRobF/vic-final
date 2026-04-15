import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

const REDIRECT_DELAY_MS = 1200

export default function TeacherPage() {
  const router = useRouter()

  const [loadingTeacher, setLoadingTeacher] = useState(true)
  const [teacher, setTeacher] = useState(null)
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [students, setStudents] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)

  const [lessonTitle, setLessonTitle] = useState('')
  const [lessonText, setLessonText] = useState('')
  const [supportMode, setSupportMode] = useState('remediation')

  const [loadingClasses, setLoadingClasses] = useState(false)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true

    async function loadTeacherAndClasses() {
      setLoadingTeacher(true)
      setError('')

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (!active) return

      if (userError || !user) {
        setTeacher(null)
        setError('No teacher is logged in. Redirecting to /login...')
        setLoadingTeacher(false)
        window.setTimeout(() => {
          router.push('/login')
        }, REDIRECT_DELAY_MS)
        return
      }

      const { data: teacherRow, error: teacherLookupError } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', user.email)
        .single()

      if (!active) return

      if (teacherLookupError || !teacherRow?.id) {
        setTeacher(null)
        setError(teacherLookupError?.message || 'Could not find teacher profile for this user.')
        setLoadingTeacher(false)
        return
      }

      setTeacher(teacherRow)
      setLoadingTeacher(false)
      await loadClasses(teacherRow.id)
    }

    loadTeacherAndClasses()

    return () => {
      active = false
    }
  }, [router])

  async function loadClasses(teacherId) {
    setLoadingClasses(true)
    setError('')

    const { data, error: classesError } = await supabase
      .from('classes')
      .select('id, class_name, teacher_id')
      .eq('teacher_id', teacherId)
      .order('class_name', { ascending: true })

    if (classesError) {
      setError(classesError.message || 'Could not load classes.')
      setClasses([])
    } else {
      setClasses(data || [])
    }

    setLoadingClasses(false)
  }

  async function handleSelectClass(classRow) {
    setSelectedClass(classRow)
    setSelectedStudent(null)
    setStudents([])
    setLessonTitle('')
    setLessonText('')
    setSupportMode('remediation')
    setNotice('')
    setError('')

    setLoadingStudents(true)

    const { data, error: studentsError } = await supabase
      .from('enrollments')
      .select('student_id, users:student_id (*)')
      .eq('class_id', classRow.id)

    if (studentsError) {
      setError(studentsError.message || 'Could not load students for this class.')
      setLoadingStudents(false)
      return
    }

    const mapped = (data || []).map((row) => {
      const userRow = Array.isArray(row.users) ? row.users[0] : row.users

      return {
        id: row.student_id,
        profile: userRow || {},
      }
    })

    setStudents(mapped)
    setLoadingStudents(false)
  }

  function getStudentName(student) {
    const profile = student?.profile || {}

    return (
      profile.full_name ||
      profile.name ||
      profile.display_name ||
      profile.email ||
      `Student ${student?.id}`
    )
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setNotice('')

    if (!selectedStudent) {
      setError('Choose a student first.')
      return
    }

    if (!lessonTitle.trim() || !lessonText.trim()) {
      setError('Lesson title and lesson text are required.')
      return
    }

    setSaving(true)

    const { data: createdLesson, error: lessonError } = await supabase
      .from('lessons')
      .insert({
        title: lessonTitle.trim(),
        lesson_text: lessonText.trim(),
      })
      .select('id')
      .single()

    if (lessonError || !createdLesson?.id) {
      setError(lessonError?.message || 'Could not create lesson.')
      setSaving(false)
      return
    }

    const { error: assignmentError } = await supabase.from('assignments').insert({
      lesson_id: createdLesson.id,
      student_id: selectedStudent.id,
      mode: supportMode,
      status: 'assigned',
    })

    if (assignmentError) {
      setError(assignmentError.message || 'Lesson was created, but assignment failed.')
      setSaving(false)
      return
    }

    setNotice('Lesson assigned successfully.')
    setLessonTitle('')
    setLessonText('')
    setSupportMode('remediation')
    setSaving(false)
  }

  return (
    <main style={{ padding: '32px 16px', maxWidth: 900, margin: '0 auto' }}>
      <h1>Teacher Portal</h1>

      {loadingTeacher ? <p>Loading teacher...</p> : null}

      {!loadingTeacher && !teacher ? <p>{error || 'No teacher is logged in.'}</p> : null}

      {teacher ? (
        <>
          <section style={{ marginBottom: 24 }}>
            <h2>Your classes</h2>
            {loadingClasses ? <p>Loading classes...</p> : null}

            {!loadingClasses && classes.length === 0 ? <p>No classes found.</p> : null}

            <div style={{ display: 'grid', gap: 8 }}>
              {classes.map((classRow) => (
                <button
                  key={classRow.id}
                  type="button"
                  onClick={() => handleSelectClass(classRow)}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid #ddd',
                    background:
                      selectedClass?.id === classRow.id ? 'rgba(0,0,0,0.06)' : 'white',
                    cursor: 'pointer',
                  }}
                >
                  {classRow.class_name}
                </button>
              ))}
            </div>
          </section>

          {selectedClass ? (
            <section style={{ marginBottom: 24 }}>
              <h2>Students in {selectedClass.class_name}</h2>
              {loadingStudents ? <p>Loading students...</p> : null}

              {!loadingStudents && students.length === 0 ? <p>No students enrolled.</p> : null}

              <div style={{ display: 'grid', gap: 8 }}>
                {students.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => {
                      setSelectedStudent(student)
                      setNotice('')
                    }}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid #ddd',
                      background:
                        selectedStudent?.id === student.id ? 'rgba(0,0,0,0.06)' : 'white',
                      cursor: 'pointer',
                    }}
                  >
                    {getStudentName(student)}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {selectedStudent ? (
            <section style={{ marginBottom: 24 }}>
              <h2>Assign lesson to {getStudentName(selectedStudent)}</h2>
              <form onSubmit={handleSave} style={{ display: 'grid', gap: 12, maxWidth: 700 }}>
                <label htmlFor="lessonTitle">lessonTitle</label>
                <input
                  id="lessonTitle"
                  type="text"
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  required
                />

                <label htmlFor="lessonText">lessonText</label>
                <textarea
                  id="lessonText"
                  rows={8}
                  value={lessonText}
                  onChange={(e) => setLessonText(e.target.value)}
                  required
                />

                <label htmlFor="supportMode">supportMode</label>
                <select
                  id="supportMode"
                  value={supportMode}
                  onChange={(e) => setSupportMode(e.target.value)}
                >
                  <option value="remediation">remediation</option>
                  <option value="on-level">on-level</option>
                  <option value="enrichment">enrichment</option>
                </select>

                <button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </form>
            </section>
          ) : null}

          {error ? (
            <p role="alert" style={{ color: 'crimson' }}>
              {error}
            </p>
          ) : null}

          {notice ? <p style={{ color: 'green' }}>{notice}</p> : null}
        </>
      ) : null}
    </main>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

const REDIRECT_DELAY_MS = 1200

function getUserDisplayName(userRow) {
  if (!userRow) return ''

  return userRow.name || userRow.email || ''
}

export default function TeacherPage() {
  const router = useRouter()

  const [loadingTeacher, setLoadingTeacher] = useState(true)
  const [teacher, setTeacher] = useState(null)
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [students, setStudents] = useState([])
  const [selectedStudentIds, setSelectedStudentIds] = useState(() => new Set())

  const [lessonTitle, setLessonTitle] = useState('')
  const [lessonText, setLessonText] = useState('')
  const [supportMode, setSupportMode] = useState('remediation')
  const [newClassName, setNewClassName] = useState('')
  const [newClassGradeLevel, setNewClassGradeLevel] = useState('')

  const [loadingClasses, setLoadingClasses] = useState(false)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [saving, setSaving] = useState(false)
  const [creatingClass, setCreatingClass] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [currentUserStatus, setCurrentUserStatus] = useState('Loading signed-in user...')

  const selectedCount = selectedStudentIds.size

  const allStudentsSelected = useMemo(() => {
    return students.length > 0 && selectedCount === students.length
  }, [selectedCount, students.length])

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
        setCurrentUserStatus('No signed-in user found.')
        setError('No teacher is logged in. Redirecting to /login...')
        setLoadingTeacher(false)
        window.setTimeout(() => {
          router.push('/login')
        }, REDIRECT_DELAY_MS)
        return
      }

      const { data: teacherRows, error: teacherLookupError } = await supabase
        .from('users')
        .select('id, email, name')
        .eq('email', user.email)
        .order('id', { ascending: true })

      const teacherRow = teacherRows?.[0]

      if (!active) return

      if (teacherLookupError || !teacherRow?.id) {
        setTeacher(null)
        setCurrentUserStatus('Signed in user found, but no matching profile row in public.users.')
        setError(teacherLookupError?.message || 'Could not find teacher profile for this user.')
        setLoadingTeacher(false)
        return
      }

      setTeacher(teacherRow)
      setCurrentUserStatus('Signed in.')
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
      .select('id, class_name, teacher_id, grade_level')
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
    setSelectedStudentIds(new Set())
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

    return profile.name || profile.email || `Student ${student?.id}`
  }

  function handleToggleStudent(studentId) {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev)

      if (next.has(studentId)) {
        next.delete(studentId)
      } else {
        next.add(studentId)
      }

      return next
    })
    setNotice('')
  }

  function handleSelectAllStudents() {
    setSelectedStudentIds(new Set(students.map((student) => student.id)))
    setNotice('')
  }

  function handleClearSelectedStudents() {
    setSelectedStudentIds(new Set())
    setNotice('')
  }

  async function handleCreateClass(e) {
    e.preventDefault()
    if (!teacher?.id) return

    const trimmedClassName = newClassName.trim()
    const trimmedGradeLevel = newClassGradeLevel.trim()

    if (!trimmedClassName) {
      setError('Class name is required.')
      return
    }

    setCreatingClass(true)
    setError('')
    setNotice('')

    const { data: createdClass, error: classInsertError } = await supabase
      .from('classes')
      .insert({
        class_name: trimmedClassName,
        grade_level: trimmedGradeLevel || null,
        teacher_id: teacher.id,
      })
      .select('id, class_name, teacher_id, grade_level')
      .single()

    if (classInsertError || !createdClass?.id) {
      setError(classInsertError?.message || 'Could not create class.')
      setCreatingClass(false)
      return
    }

    const nextClasses = [...classes, createdClass].sort((a, b) =>
      (a.class_name || '').localeCompare(b.class_name || '')
    )

    setClasses(nextClasses)
    setNewClassName('')
    setNewClassGradeLevel('')
    setNotice('Class created.')
    setCreatingClass(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setNotice('')

    if (selectedCount === 0) {
      setError('Select at least one student first.')
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

    const assignmentRows = Array.from(selectedStudentIds).map((studentId) => ({
      lesson_id: createdLesson.id,
      student_id: studentId,
      mode: supportMode,
      status: 'assigned',
    }))

    const { error: assignmentError } = await supabase.from('assignments').insert(assignmentRows)

    if (assignmentError) {
      setError(assignmentError.message || 'Lesson was created, but assignment failed.')
      setSaving(false)
      return
    }

    setNotice(`Lesson assigned successfully to ${selectedCount} students.`)
    setSelectedStudentIds(new Set())
    setLessonTitle('')
    setLessonText('')
    setSupportMode('remediation')
    setSaving(false)
  }

  return (
    <main style={{ padding: '32px 16px', maxWidth: 900, margin: '0 auto' }}>
      <h1>Teacher Portal</h1>
      <section
        style={{
          margin: '12px 0 20px',
          border: '1px solid #ddd',
          borderRadius: 8,
          padding: '10px 12px',
          background: '#fafafa',
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.75 }}>Signed in</div>
        <div style={{ fontWeight: 600 }}>{getUserDisplayName(teacher) || 'Name unavailable'}</div>
        <div style={{ fontSize: 14 }}>{teacher?.email || currentUserStatus}</div>
      </section>

      {loadingTeacher ? <p>Loading teacher...</p> : null}

      {!loadingTeacher && !teacher ? <p>{error || 'No teacher is logged in.'}</p> : null}

      {teacher ? (
        <>
          <section style={{ marginBottom: 24 }}>
            <h2>Your classes</h2>
            <form onSubmit={handleCreateClass} style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
              <label htmlFor="newClassName">Class name</label>
              <input
                id="newClassName"
                type="text"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="e.g. Algebra Period 2"
                required
              />

              <label htmlFor="newClassGradeLevel">Grade level</label>
              <input
                id="newClassGradeLevel"
                type="text"
                value={newClassGradeLevel}
                onChange={(e) => setNewClassGradeLevel(e.target.value)}
                placeholder="e.g. 7"
              />

              <button type="submit" disabled={creatingClass}>
                {creatingClass ? 'Creating class...' : 'Create class'}
              </button>
            </form>

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
                  <div>{classRow.class_name}</div>
                  {classRow.grade_level ? (
                    <div style={{ fontSize: 12, opacity: 0.75 }}>Grade: {classRow.grade_level}</div>
                  ) : null}
                </button>
              ))}
            </div>
          </section>

          {selectedClass ? (
            <section style={{ marginBottom: 24 }}>
              <h2>Students in {selectedClass.class_name}</h2>
              {loadingStudents ? <p>Loading students...</p> : null}

              {!loadingStudents && students.length === 0 ? <p>No students enrolled.</p> : null}

              {!loadingStudents && students.length > 0 ? (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      marginBottom: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <button
                      type="button"
                      onClick={handleSelectAllStudents}
                      disabled={allStudentsSelected}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleClearSelectedStudents}
                      disabled={selectedCount === 0}
                    >
                      Clear All
                    </button>
                    <span>{selectedCount} students selected</span>
                  </div>

                  <div style={{ display: 'grid', gap: 8 }}>
                    {students.map((student) => (
                      <label
                        key={student.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 12px',
                          borderRadius: 8,
                          border: '1px solid #ddd',
                          background: selectedStudentIds.has(student.id)
                            ? 'rgba(0,0,0,0.06)'
                            : 'white',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.has(student.id)}
                          onChange={() => handleToggleStudent(student.id)}
                        />
                        <span>{getStudentName(student)}</span>
                      </label>
                    ))}
                  </div>
                </>
              ) : null}
            </section>
          ) : null}

          {selectedClass ? (
            <section style={{ marginBottom: 24 }}>
              <h2>Assign lesson to selected students</h2>
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

                <button type="submit" disabled={saving || selectedCount === 0}>
                  {saving ? 'Assigning...' : 'Assign Lesson to Selected Students'}
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

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import VICHeader from '../components/VICHeader'

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
    let mounted = true

    async function initializeTeacherPage() {
      setError('')
      setNotice('')
      setLoadingTeacher(true)
      setCurrentUserStatus('Loading signed-in user...')

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (!mounted) return

      if (authError || !user?.email) {
        setTeacher(null)
        setLoadingTeacher(false)
        setCurrentUserStatus('No signed-in user found.')
        setError('Please log in as a teacher to use Teacher Portal.')
        setTimeout(() => {
          router.push('/login')
        }, REDIRECT_DELAY_MS)
        return
      }

      setCurrentUserStatus(`Signed in as ${user.email}`)

      const { data: teacherRows, error: teacherLookupError } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('email', user.email)
        .order('id', { ascending: true })
        .limit(1)

      if (!mounted) return

      const matchedTeacher = teacherRows?.[0]

      if (teacherLookupError || !matchedTeacher?.id) {
        setTeacher(null)
        setLoadingTeacher(false)
        setError('Could not load teacher profile. Please contact your administrator.')
        return
      }

      if (matchedTeacher.role !== 'teacher') {
        setTeacher(null)
        setLoadingTeacher(false)
        setError('This account is not marked as teacher in public.users.')
        return
      }

      setTeacher(matchedTeacher)
      setLoadingTeacher(false)
      fetchClasses(matchedTeacher.id)
    }

    initializeTeacherPage()

    return () => {
      mounted = false
    }
  }, [router])

  async function fetchClasses(teacherId) {
    if (!teacherId) return

    setLoadingClasses(true)
    setError('')

    const { data, error: classError } = await supabase
      .from('classes')
      .select('id, class_name, grade_level, class_code')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: true })

    if (classError) {
      setError(classError.message || 'Could not load classes.')
      setClasses([])
      setLoadingClasses(false)
      return
    }

    const classRows = Array.isArray(data) ? data : []
    setClasses(classRows)
    setLoadingClasses(false)

    if (classRows.length === 0) {
      setSelectedClass(null)
      setStudents([])
      setSelectedStudentIds(new Set())
    }
  }

  async function fetchStudents(classId) {
    if (!classId) return

    setLoadingStudents(true)
    setError('')

    const { data, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('student_id, users:student_id (id, name, email)')
      .eq('class_id', classId)

    if (enrollmentError) {
      setError(enrollmentError.message || 'Could not load students for this class.')
      setStudents([])
      setSelectedStudentIds(new Set())
      setLoadingStudents(false)
      return
    }

    const mappedStudents =
      data
        ?.map((row) => {
          const userRow = Array.isArray(row.users) ? row.users[0] : row.users
          return userRow?.id ? userRow : null
        })
        .filter(Boolean) || []

    setStudents(mappedStudents)
    setSelectedStudentIds(new Set())
    setLoadingStudents(false)
  }

  function handleSelectClass(classRow) {
    setSelectedClass(classRow)
    setStudents([])
    setSelectedStudentIds(new Set())
    fetchStudents(classRow.id)
  }

  function handleToggleStudent(studentId) {
    setSelectedStudentIds((previous) => {
      const next = new Set(previous)

      if (next.has(studentId)) {
        next.delete(studentId)
      } else {
        next.add(studentId)
      }

      return next
    })
  }

  function handleSelectAllStudents() {
    const allIds = new Set(students.map((student) => student.id))
    setSelectedStudentIds(allIds)
  }

  function handleClearSelectedStudents() {
    setSelectedStudentIds(new Set())
  }

  function getStudentName(student) {
    if (!student) return 'Unnamed student'

    return student.name || student.email || `Student ${student.id}`
  }

  async function handleCreateClass(e) {
    e.preventDefault()

    if (!teacher?.id) {
      setError('No teacher is loaded yet.')
      return
    }

    const trimmedName = newClassName.trim()
    const trimmedGrade = newClassGradeLevel.trim()

    if (!trimmedName) {
      setError('Class name is required.')
      return
    }

    setCreatingClass(true)
    setError('')
    setNotice('')

    const classCode = Math.random().toString(36).slice(2, 8).toUpperCase()

    const { error: insertError } = await supabase.from('classes').insert({
      class_name: trimmedName,
      teacher_id: teacher.id,
      grade_level: trimmedGrade || null,
      class_code: classCode,
    })

    if (insertError) {
      setError(insertError.message || 'Could not create class.')
      setCreatingClass(false)
      return
    }

    setNotice(`Class created successfully. Class code: ${classCode}`)
    setNewClassName('')
    setNewClassGradeLevel('')
    setCreatingClass(false)
    fetchClasses(teacher.id)
  }

  async function handleSave(e) {
    e.preventDefault()

    if (selectedCount === 0) {
      setError('Please select at least one student.')
      return
    }

    if (!lessonTitle.trim() || !lessonText.trim()) {
      setError('Lesson title and lesson text are required.')
      return
    }

    setError('')
    setNotice('')
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
    <main className="teacherPage">
      <div className="teacherShell">
        <VICHeader currentPath="/teacher" />
        <h1>Teacher Portal</h1>

        <section className="card profileCard">
          <div className="cardEyebrow">Signed in</div>
          <div className="signedInName">{getUserDisplayName(teacher) || 'Name unavailable'}</div>
          <div className="signedInMeta">{teacher?.email || currentUserStatus}</div>
        </section>

        {loadingTeacher ? <p className="statusText">Loading teacher...</p> : null}

        {!loadingTeacher && !teacher ? <p className="statusText">{error || 'No teacher is logged in.'}</p> : null}

        {teacher ? (
          <>
            <section className="card sectionCard">
              <h2>Your classes</h2>
              <form onSubmit={handleCreateClass} className="stackForm">
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

                <button className="primaryButton" type="submit" disabled={creatingClass}>
                  {creatingClass ? 'Creating class...' : 'Create class'}
                </button>
              </form>

              {loadingClasses ? <p className="statusText">Loading classes...</p> : null}

              {!loadingClasses && classes.length === 0 ? <p className="statusText">No classes found.</p> : null}

              <div className="classList">
                {classes.map((classRow) => (
                  <button
                    key={classRow.id}
                    type="button"
                    onClick={() => handleSelectClass(classRow)}
                    className={selectedClass?.id === classRow.id ? 'rowButton selected' : 'rowButton'}
                  >
                    <div>{classRow.class_name}</div>
                    {classRow.grade_level ? <div className="rowSubtext">Grade: {classRow.grade_level}</div> : null}
                  </button>
                ))}
              </div>
            </section>

            {selectedClass ? (
              <section className="card sectionCard">
                <h2>Students in {selectedClass.class_name}</h2>
                {loadingStudents ? <p className="statusText">Loading students...</p> : null}

                {!loadingStudents && students.length === 0 ? <p className="statusText">No students enrolled.</p> : null}

                {!loadingStudents && students.length > 0 ? (
                  <>
                    <div className="controlsRow">
                      <button
                        className="secondaryButton"
                        type="button"
                        onClick={handleSelectAllStudents}
                        disabled={allStudentsSelected}
                      >
                        Select All
                      </button>
                      <button
                        className="secondaryButton"
                        type="button"
                        onClick={handleClearSelectedStudents}
                        disabled={selectedCount === 0}
                      >
                        Clear All
                      </button>
                      <span className="selectionCount">{selectedCount} students selected</span>
                    </div>

                    <div className="studentList">
                      {students.map((student) => (
                        <label
                          key={student.id}
                          className={selectedStudentIds.has(student.id) ? 'rowItem selected' : 'rowItem'}
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
              <section className="card sectionCard">
                <h2>Assign lesson to selected students</h2>
                <form onSubmit={handleSave} className="stackForm lessonForm">
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
                  <select id="supportMode" value={supportMode} onChange={(e) => setSupportMode(e.target.value)}>
                    <option value="remediation">remediation</option>
                    <option value="on-level">on-level</option>
                    <option value="enrichment">enrichment</option>
                  </select>

                  <button className="primaryButton" type="submit" disabled={saving || selectedCount === 0}>
                    {saving ? 'Assigning...' : 'Assign Lesson to Selected Students'}
                  </button>
                </form>
              </section>
            ) : null}

            {error ? (
              <p role="alert" className="errorText">
                {error}
              </p>
            ) : null}

            {notice ? <p className="noticeText">{notice}</p> : null}
          </>
        ) : null}
      </div>
      <style jsx>{`
        .teacherPage {
          min-height: 100vh;
          background: radial-gradient(circle at 0% 0%, rgba(96, 117, 255, 0.12), transparent 25%), #07070d;
          color: #fff;
          padding: 28px 16px 40px;
        }
        .teacherShell {
          max-width: 940px;
          margin: 0 auto;
          display: grid;
          gap: 18px;
        }
        h1 {
          margin: 0;
          font-size: 31px;
          line-height: 1.12;
          font-weight: 800;
        }
        h2 {
          margin: 0;
          font-size: 22px;
          font-weight: 750;
        }
        .card {
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 18px;
          background: rgba(17, 19, 32, 0.9);
          box-shadow: 0 14px 34px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.03);
          padding: 22px;
        }
        .profileCard {
          display: grid;
          gap: 4px;
        }
        .sectionCard {
          display: grid;
          gap: 16px;
        }
        .cardEyebrow {
          font-size: 12px;
          color: rgba(235, 239, 255, 0.74);
        }
        .signedInName {
          font-size: 18px;
          font-weight: 700;
        }
        .signedInMeta {
          font-size: 14px;
          color: rgba(235, 239, 255, 0.84);
        }
        .statusText {
          margin: 0;
          color: rgba(235, 239, 255, 0.85);
        }
        .stackForm {
          display: grid;
          gap: 12px;
        }
        .lessonForm {
          max-width: 700px;
        }
        label {
          font-size: 13px;
          color: rgba(235, 239, 255, 0.96);
        }
        :global(.teacherPage input),
        :global(.teacherPage textarea),
        :global(.teacherPage select),
        :global(.teacherPage button) {
          font: inherit;
          border-radius: 12px;
        }
        :global(.teacherPage input),
        :global(.teacherPage textarea),
        :global(.teacherPage select) {
          width: 100%;
          padding: 12px 14px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.06);
          color: #fff;
        }
        .primaryButton,
        .secondaryButton {
          padding: 12px 16px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.12s ease, filter 0.12s ease, background 0.12s ease;
        }
        .primaryButton {
          border: 1px solid rgba(154, 171, 255, 0.48);
          color: #fff;
          background: linear-gradient(135deg, #6675ff 0%, #7a60ff 58%, #4f7cff 100%);
          box-shadow: 0 0 20px rgba(102, 117, 255, 0.24);
        }
        .secondaryButton {
          border: 1px solid rgba(255, 255, 255, 0.22);
          color: #eef2ff;
          background: rgba(255, 255, 255, 0.08);
        }
        .primaryButton:hover,
        .secondaryButton:hover {
          filter: brightness(1.05);
        }
        .primaryButton:active,
        .secondaryButton:active {
          transform: translateY(1px);
        }
        .primaryButton:disabled,
        .secondaryButton:disabled {
          opacity: 0.75;
          cursor: not-allowed;
          box-shadow: none;
        }
        .classList,
        .studentList {
          display: grid;
          gap: 10px;
        }
        .rowButton,
        .rowItem {
          text-align: left;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.04);
          color: #fff;
        }
        .rowButton {
          cursor: pointer;
        }
        .rowButton:hover {
          background: rgba(255, 255, 255, 0.08);
        }
        .rowItem {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
        }
        .selected {
          background: rgba(130, 130, 255, 0.2);
          border-color: rgba(154, 171, 255, 0.46);
        }
        .rowSubtext {
          font-size: 12px;
          color: rgba(235, 239, 255, 0.74);
          margin-top: 4px;
        }
        .controlsRow {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .selectionCount {
          font-size: 14px;
          color: rgba(235, 239, 255, 0.8);
        }
        .errorText {
          color: #ff9ca8;
          margin: 0;
          line-height: 1.45;
        }
        .noticeText {
          color: #92f7bb;
          margin: 0;
          line-height: 1.45;
        }
      `}</style>
    </main>
  )
}

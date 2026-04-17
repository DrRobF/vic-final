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
  const [classFeedback, setClassFeedback] = useState(null)
  const [lessonFeedback, setLessonFeedback] = useState(null)
  const [currentUserStatus, setCurrentUserStatus] = useState('Loading signed-in user...')
  const [copiedCode, setCopiedCode] = useState(false)

  const selectedCount = selectedStudentIds.size

  const allStudentsSelected = useMemo(() => {
    return students.length > 0 && selectedCount === students.length
  }, [selectedCount, students.length])

  useEffect(() => {
    let mounted = true

    async function initializeTeacherPage() {
      setError('')
      setClassFeedback(null)
      setLessonFeedback(null)
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
        .select('id, auth_user_id, name, email, role')
        .eq('auth_user_id', user.id)
        .order('id', { ascending: true })
        .limit(1)

      if (!mounted) return

      const matchedTeacherByAuth = teacherRows?.[0]
      let matchedTeacher = matchedTeacherByAuth

      if (!matchedTeacherByAuth?.id && user.email) {
        const { data: teacherRowsByEmail } = await supabase
          .from('users')
          .select('id, auth_user_id, name, email, role')
          .eq('email', user.email)
          .order('id', { ascending: true })
          .limit(1)

        matchedTeacher = teacherRowsByEmail?.[0] || null
      }

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

  async function fetchClasses(teacherId, classIdToSelect = null) {
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
      return
    }

    if (classIdToSelect) {
      const matchingClass = classRows.find((row) => row.id === classIdToSelect)
      if (matchingClass) {
        handleSelectClass(matchingClass)
      }
    }
  }

  async function fetchStudents(classId) {
    if (!classId) return

    setLoadingStudents(true)
    setError('')

    const { data, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('student_id, users!inner(id, name, email)')
      .eq('class_id', classId)
      .order('student_id', { ascending: true })

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
    setCopiedCode(false)
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
      setClassFeedback({ type: 'error', message: 'No teacher profile is loaded yet.' })
      return
    }

    const trimmedName = newClassName.trim()
    const trimmedGrade = newClassGradeLevel.trim()

    if (!trimmedName) {
      setClassFeedback({ type: 'error', message: 'Please enter a class name before creating a class.' })
      return
    }

    setCreatingClass(true)
    setError('')
    setClassFeedback(null)

    const { data: createdClass, error: insertError } = await supabase
      .from('classes')
      .insert({
        class_name: trimmedName,
        teacher_id: teacher.id,
        grade_level: trimmedGrade || null,
      })
      .select('id, class_name, grade_level, class_code')
      .single()

    if (insertError || !createdClass?.id) {
      setClassFeedback({ type: 'error', message: insertError?.message || 'Could not create class.' })
      setCreatingClass(false)
      return
    }

    setClassFeedback({
      type: 'success',
      message: `Class created! Share class code ${createdClass.class_code} with students so they can join.`,
    })
    setNewClassName('')
    setNewClassGradeLevel('')
    setCreatingClass(false)
    await fetchClasses(teacher.id, createdClass.id)
  }

  async function handleCopyClassCode() {
    if (!selectedClass?.class_code || !navigator?.clipboard?.writeText) {
      return
    }

    try {
      await navigator.clipboard.writeText(selectedClass.class_code)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 1500)
    } catch {
      setCopiedCode(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()

    if (selectedCount === 0) {
      setLessonFeedback({
        type: 'error',
        message: 'Choose at least one student in “Selected students” before assigning a lesson.',
      })
      return
    }

    if (!lessonTitle.trim() || !lessonText.trim()) {
      setLessonFeedback({ type: 'error', message: 'Please add a lesson title and lesson instructions.' })
      return
    }

    setError('')
    setLessonFeedback(null)
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
      setLessonFeedback({ type: 'error', message: lessonError?.message || 'Could not create lesson.' })
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
      setLessonFeedback({
        type: 'error',
        message: assignmentError.message || 'Lesson was created, but assignment failed.',
      })
      setSaving(false)
      return
    }

    setLessonFeedback({ type: 'success', message: `Lesson assigned to ${selectedCount} students.` })
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
        <h1>Teacher Dashboard</h1>

        <section className="card profileCard">
          <div className="cardEyebrow">Signed in</div>
          <div className="signedInName">{getUserDisplayName(teacher) || 'Name unavailable'}</div>
          <div className="signedInMeta">{teacher?.email || currentUserStatus}</div>
        </section>

        {loadingTeacher ? <p className="statusText">Loading teacher...</p> : null}

        {!loadingTeacher && !teacher ? <p className="statusText">{error || 'No teacher is logged in.'}</p> : null}

        {teacher ? (
          <>
            <div className="topGrid">
              <section className="card sectionCard">
                <h2>Section A — My Classes</h2>
                <p className="helperText">Create a class, then click a class below to manage students and assign lessons.</p>

                <div className="innerCard">
                  <h3>Create a class</h3>
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

                    <label htmlFor="newClassGradeLevel">Grade level (optional)</label>
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
                </div>

                {classFeedback ? (
                  <p role={classFeedback.type === 'error' ? 'alert' : 'status'} className={classFeedback.type === 'error' ? 'errorText' : 'noticeText'}>
                    {classFeedback.message}
                  </p>
                ) : null}

                <div className="innerCard">
                  <h3>Existing classes</h3>
                  {loadingClasses ? <p className="statusText">Loading classes...</p> : null}
                  {!loadingClasses && classes.length === 0 ? (
                    <p className="statusText">No classes yet. Create your first class above.</p>
                  ) : null}

                  <div className="classList">
                    {classes.map((classRow) => (
                      <button
                        key={classRow.id}
                        type="button"
                        onClick={() => handleSelectClass(classRow)}
                        className={selectedClass?.id === classRow.id ? 'rowButton selected classRowButton' : 'rowButton classRowButton'}
                      >
                        <div className="rowTitle">{classRow.class_name}</div>
                        {classRow.grade_level ? <div className="rowSubtext">Grade {classRow.grade_level}</div> : null}
                        {classRow.class_code ? <div className="rowSubtext">Code: {classRow.class_code}</div> : null}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="card sectionCard">
                <h2>Section B — Selected Class Details</h2>
                {!selectedClass ? (
                  <p className="statusText">Select a class from “My Classes” to see class details and class code.</p>
                ) : (
                  <>
                    <div className="detailGrid">
                      <div className="detailItem">
                        <div className="detailLabel">Class name</div>
                        <div className="detailValue">{selectedClass.class_name}</div>
                      </div>
                      <div className="detailItem">
                        <div className="detailLabel">Grade level</div>
                        <div className="detailValue">{selectedClass.grade_level || 'Not set'}</div>
                      </div>
                      <div className="detailItem">
                        <div className="detailLabel">Enrolled students</div>
                        <div className="detailValue">{loadingStudents ? 'Loading...' : students.length}</div>
                      </div>
                    </div>

                    <div className="classCodeCard">
                      <div className="detailLabel">Class code</div>
                      <div className="classCodeValue">{selectedClass.class_code || 'Unavailable'}</div>
                      <p className="helperText">Share this class code with students so they can join.</p>
                      <button
                        type="button"
                        className="secondaryButton copyButton"
                        onClick={handleCopyClassCode}
                        disabled={!selectedClass.class_code}
                      >
                        {copiedCode ? 'Copied!' : 'Copy class code'}
                      </button>
                    </div>
                  </>
                )}
              </section>
            </div>

            {selectedClass ? (
              <section className="card sectionCard">
                <h2>Section C — Assign Lesson</h2>
                <p className="helperText">Fill out the lesson details, choose support level, select students, then assign.</p>

                <form onSubmit={handleSave} className="stackForm lessonForm">
                  <div className="innerCard">
                    <label htmlFor="lessonTitle">Lesson title</label>
                    <input
                      id="lessonTitle"
                      type="text"
                      value={lessonTitle}
                      onChange={(e) => setLessonTitle(e.target.value)}
                      placeholder="e.g. Practice solving one-step equations"
                      required
                    />

                    <label htmlFor="lessonText">What should students work on?</label>
                    <textarea
                      id="lessonText"
                      rows={8}
                      value={lessonText}
                      onChange={(e) => setLessonText(e.target.value)}
                      placeholder="Add clear directions students should follow."
                      required
                    />

                    <label htmlFor="supportMode">Support level</label>
                    <select id="supportMode" value={supportMode} onChange={(e) => setSupportMode(e.target.value)}>
                      <option value="remediation">Remediation</option>
                      <option value="on-level">On-level</option>
                      <option value="enrichment">Enrichment</option>
                    </select>
                  </div>

                  <div className="innerCard">
                    <div className="studentHeaderRow">
                      <h3>Selected students</h3>
                      <span className="selectionCount">{selectedCount} selected</span>
                    </div>

                    {loadingStudents ? <p className="statusText">Loading students...</p> : null}

                    {!loadingStudents && students.length === 0 ? (
                      <p className="statusText">No students enrolled in this class yet.</p>
                    ) : null}

                    {!loadingStudents && students.length > 0 ? (
                      <>
                        <div className="controlsRow">
                          <button
                            className="secondaryButton"
                            type="button"
                            onClick={handleSelectAllStudents}
                            disabled={allStudentsSelected}
                          >
                            Select all
                          </button>
                          <button
                            className="secondaryButton"
                            type="button"
                            onClick={handleClearSelectedStudents}
                            disabled={selectedCount === 0}
                          >
                            Clear selection
                          </button>
                        </div>

                        <div className="studentList">
                          {students.map((student) => (
                            <label key={student.id} className={selectedStudentIds.has(student.id) ? 'rowItem selected' : 'rowItem'}>
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
                  </div>

                  <button className="primaryButton" type="submit" disabled={saving || selectedCount === 0}>
                    {saving ? 'Assigning...' : 'Assign lesson'}
                  </button>
                </form>

                {lessonFeedback ? (
                  <p role={lessonFeedback.type === 'error' ? 'alert' : 'status'} className={lessonFeedback.type === 'error' ? 'errorText' : 'noticeText'}>
                    {lessonFeedback.message}
                  </p>
                ) : null}
              </section>
            ) : null}

            {error ? (
              <p role="alert" className="errorText">
                {error}
              </p>
            ) : null}
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
          max-width: 1120px;
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
        h3 {
          margin: 0;
          font-size: 17px;
          font-weight: 700;
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
        .topGrid {
          display: grid;
          gap: 18px;
          align-items: start;
        }
        .innerCard {
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.03);
          padding: 16px;
          display: grid;
          gap: 12px;
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
        .helperText,
        .statusText {
          margin: 0;
          color: rgba(235, 239, 255, 0.85);
          font-size: 14px;
        }
        .stackForm {
          display: grid;
          gap: 12px;
        }
        .lessonForm {
          gap: 14px;
        }
        label,
        .detailLabel {
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
          background: rgba(255, 255, 255, 0.08);
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
        .copyButton {
          width: fit-content;
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
        .classRowButton {
          display: grid;
          gap: 2px;
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
          background: rgba(130, 130, 255, 0.24);
          border-color: rgba(154, 171, 255, 0.68);
          box-shadow: inset 0 0 0 1px rgba(154, 171, 255, 0.2);
        }
        .rowTitle,
        .detailValue {
          font-size: 16px;
          font-weight: 700;
        }
        .rowSubtext {
          font-size: 12px;
          color: rgba(235, 239, 255, 0.74);
          margin-top: 2px;
        }
        .controlsRow,
        .studentHeaderRow {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: space-between;
        }
        .selectionCount {
          font-size: 14px;
          color: rgba(235, 239, 255, 0.8);
        }
        .detailGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        .detailItem {
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          padding: 12px;
          background: rgba(255, 255, 255, 0.03);
          display: grid;
          gap: 5px;
        }
        .classCodeCard {
          border-radius: 14px;
          border: 1px solid rgba(159, 170, 255, 0.42);
          background: linear-gradient(145deg, rgba(96, 117, 255, 0.26), rgba(113, 69, 209, 0.2));
          padding: 16px;
          display: grid;
          gap: 8px;
        }
        .classCodeValue {
          font-size: 30px;
          line-height: 1;
          letter-spacing: 0.08em;
          font-weight: 800;
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

        @media (min-width: 900px) {
          .topGrid {
            grid-template-columns: 1.15fr 0.85fr;
          }
        }

        @media (max-width: 720px) {
          .detailGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  )
}

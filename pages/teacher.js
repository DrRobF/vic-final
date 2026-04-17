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
  console.log('[DEBUG] selectedClass:', selectedClass)

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

  useEffect(() => {
    if (!selectedClass?.id) return

    console.log('[DEBUG] triggering student load for class:', selectedClass.id)
    loadStudents(selectedClass.id)
  }, [selectedClass?.id])

  async function loadStudents(classId) {
    if (!classId) return

    setLoadingStudents(true)
    setError('')

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session?.access_token) {
      setError('Please sign in again to load students.')
      setStudents([])
      setSelectedStudentIds(new Set())
      setLoadingStudents(false)
      return
    }

    const response = await fetch('/api/teacher/class-students', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ classId }),
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      setError(payload?.error || 'Could not load students for this class.')
      setStudents([])
      setSelectedStudentIds(new Set())
      setLoadingStudents(false)
      return
    }

    const nextStudents = Array.isArray(payload?.students) ? payload.students : []

    setStudents(nextStudents)
    setSelectedStudentIds(new Set())
    setLoadingStudents(false)
  }

  function handleSelectClass(classRow) {
    setSelectedClass(classRow)
    setCopiedCode(false)
    setStudents([])
    setSelectedStudentIds(new Set())
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

        <section className="card profileCard">
          <div className="cardEyebrow">Signed in</div>
          <div className="signedInName">{getUserDisplayName(teacher) || 'Name unavailable'}</div>
          <div className="signedInMeta">{teacher?.email || currentUserStatus}</div>
        </section>

        {loadingTeacher ? <p className="statusText">Loading teacher...</p> : null}
        {!loadingTeacher && !teacher ? <p className="statusText">{error || 'No teacher is logged in.'}</p> : null}

        {teacher ? (
          <>
            <section className="card heroCard">
              <div className="heroHeaderRow">
                <div>
                  <div className="cardEyebrow">Class command center</div>
                  <h1>Teacher Dashboard</h1>
                  <p className="helperText">Pick your class, review your roster, and assign support in one compact workflow.</p>
                </div>
                <div className="heroKicker">Workflow-first</div>
              </div>

              <div className="innerCard classSwitcherCard">
                <div className="studentHeaderRow">
                  <h3>Choose class</h3>
                  <span className="selectionCount">{classes.length} total</span>
                </div>

                {loadingClasses ? <p className="statusText">Loading classes...</p> : null}
                {!loadingClasses && classes.length === 0 ? <p className="statusText">No classes yet. Create your first class in setup below.</p> : null}

                {!loadingClasses && classes.length > 0 ? (
                  <div className="classList compactClassList">
                    {classes.map((classRow) => (
                      <button
                        key={classRow.id}
                        type="button"
                        onClick={() => handleSelectClass(classRow)}
                        className={selectedClass?.id === classRow.id ? 'rowButton selected classRowButton' : 'rowButton classRowButton'}
                      >
                        <div className="rowTitle">{classRow.class_name}</div>
                        <div className="rowSubtext">{classRow.grade_level ? `Grade ${classRow.grade_level}` : 'Grade not set'}</div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {!selectedClass ? (
                <p className="statusText">Select a class above to activate your command center.</p>
              ) : (
                <div className="commandGrid">
                  <div className="commandPrimary">
                    <div className="detailLabel">Selected class</div>
                    <div className="commandClassName">{selectedClass.class_name}</div>
                    <p className="helperText">Use this class code for enrollment and assign lessons to the roster below.</p>

                    <div className="detailGrid">
                      <div className="detailItem">
                        <div className="detailLabel">Class code</div>
                        <div className="detailValue">{selectedClass.class_code || 'Unavailable'}</div>
                      </div>
                      <div className="detailItem">
                        <div className="detailLabel">Enrolled</div>
                        <div className="detailValue">{loadingStudents ? 'Loading...' : students.length}</div>
                      </div>
                      <div className="detailItem">
                        <div className="detailLabel">Grade level</div>
                        <div className="detailValue">{selectedClass.grade_level || 'Not set'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="classCodeCard">
                    <div className="detailLabel">Class code</div>
                    <div className="classCodeValue">{selectedClass.class_code || 'Unavailable'}</div>
                    <p className="helperText">Share this code so students can join the class instantly.</p>
                    <button
                      type="button"
                      className="secondaryButton copyButton"
                      onClick={handleCopyClassCode}
                      disabled={!selectedClass.class_code}
                    >
                      {copiedCode ? 'Copied!' : 'Copy class code'}
                    </button>
                  </div>
                </div>
              )}
            </section>

            {selectedClass ? (
              <section className="card sectionCard">
                <div className="studentHeaderRow">
                  <div>
                    <div className="cardEyebrow">Student selection</div>
                    <h2>Roster</h2>
                    <p className="helperText">Choose individual students or select all to assign this lesson faster.</p>
                  </div>
                  <span className="selectionPill">{selectedCount} selected</span>
                </div>

                {loadingStudents ? <p className="statusText">Loading students...</p> : null}
                {!loadingStudents && students.length === 0 ? <p className="statusText">No students enrolled in this class yet.</p> : null}

                {!loadingStudents && students.length > 0 ? (
                  <>
                    <div className="controlsRow">
                      <button className="secondaryButton" type="button" onClick={handleSelectAllStudents} disabled={allStudentsSelected}>
                        Select all
                      </button>
                      <button className="secondaryButton" type="button" onClick={handleClearSelectedStudents} disabled={selectedCount === 0}>
                        Clear selection
                      </button>
                    </div>

                    <div className="studentGrid">
                      {students.map((student) => {
                        const isSelected = selectedStudentIds.has(student.id)

                        return (
                          <label key={student.id} className={isSelected ? 'studentTile selected' : 'studentTile'}>
                            <span className="studentName">{getStudentName(student)}</span>
                            <input type="checkbox" checked={isSelected} onChange={() => handleToggleStudent(student.id)} />
                          </label>
                        )
                      })}
                    </div>
                  </>
                ) : null}
              </section>
            ) : null}

            {selectedClass ? (
              <section className="card sectionCard lessonShell">
                <div>
                  <div className="cardEyebrow">Assign lesson</div>
                  <h2>Lesson assignment</h2>
                  <p className="helperText">Build the task, set support level, and assign to selected students.</p>
                </div>

                <form onSubmit={handleSave} className="stackForm lessonForm">
                  <div className="innerCard lessonSurface">
                    <label htmlFor="lessonTitle">Lesson title</label>
                    <input
                      id="lessonTitle"
                      type="text"
                      value={lessonTitle}
                      onChange={(e) => setLessonTitle(e.target.value)}
                      placeholder="e.g. Practice solving one-step equations"
                      required
                    />

                    <label htmlFor="lessonText">Instructions</label>
                    <textarea
                      id="lessonText"
                      rows={7}
                      value={lessonText}
                      onChange={(e) => setLessonText(e.target.value)}
                      placeholder="Add clear directions students should follow."
                      required
                    />

                    <label htmlFor="supportMode">Support level</label>
                    <div className="selectWrap">
                      <select id="supportMode" value={supportMode} onChange={(e) => setSupportMode(e.target.value)}>
                        <option value="remediation">Remediation</option>
                        <option value="on-level">On-level</option>
                        <option value="enrichment">Enrichment</option>
                      </select>
                    </div>
                    <p className="helperText microCopy">Support level controls how strongly VIC scaffolds the assignment.</p>
                  </div>

                  <button className="primaryButton assignButton" type="submit" disabled={saving || selectedCount === 0}>
                    {saving ? 'Assigning...' : `Assign lesson to ${selectedCount} student${selectedCount === 1 ? '' : 's'}`}
                  </button>
                </form>

                {lessonFeedback ? (
                  <p role={lessonFeedback.type === 'error' ? 'alert' : 'status'} className={lessonFeedback.type === 'error' ? 'errorText' : 'noticeText'}>
                    {lessonFeedback.message}
                  </p>
                ) : null}
              </section>
            ) : null}

            <section className="card sectionCard adminSection">
              <div>
                <div className="cardEyebrow">Setup & management</div>
                <h2>Create / Manage Classes</h2>
                <p className="helperText">Use this section when adding a new class or updating your class lineup.</p>
              </div>

              <div className="adminGrid">
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

                    <button className="secondaryButton" type="submit" disabled={creatingClass}>
                      {creatingClass ? 'Creating class...' : 'Create class'}
                    </button>
                  </form>

                  {classFeedback ? (
                    <p role={classFeedback.type === 'error' ? 'alert' : 'status'} className={classFeedback.type === 'error' ? 'errorText' : 'noticeText'}>
                      {classFeedback.message}
                    </p>
                  ) : null}
                </div>

                <div className="innerCard">
                  <h3>All classes</h3>
                  {loadingClasses ? <p className="statusText">Loading classes...</p> : null}
                  {!loadingClasses && classes.length === 0 ? <p className="statusText">No classes yet.</p> : null}

                  {!loadingClasses && classes.length > 0 ? (
                    <div className="classList">
                      {classes.map((classRow) => (
                        <button
                          key={`admin-${classRow.id}`}
                          type="button"
                          onClick={() => handleSelectClass(classRow)}
                          className={selectedClass?.id === classRow.id ? 'rowButton selected classRowButton' : 'rowButton classRowButton'}
                        >
                          <div className="rowTitle">{classRow.class_name}</div>
                          <div className="rowSubtext">{classRow.grade_level ? `Grade ${classRow.grade_level}` : 'Grade not set'}</div>
                          {classRow.class_code ? <div className="rowSubtext">Code: {classRow.class_code}</div> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

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
          background:
            radial-gradient(circle at 5% 0%, rgba(114, 102, 255, 0.2), transparent 35%),
            radial-gradient(circle at 90% 10%, rgba(175, 84, 255, 0.13), transparent 40%),
            #070710;
          color: #1a1a1a;
          padding: 28px 16px 40px;
        }
        .teacherShell {
          max-width: 1120px;
          margin: 0 auto;
          display: grid;
          gap: 16px;
        }
        h1 {
          margin: 0;
          font-size: clamp(28px, 3.5vw, 38px);
          line-height: 1.05;
          font-weight: 800;
          letter-spacing: -0.02em;
        }
        h2 {
          margin: 0;
          font-size: 27px;
          font-weight: 760;
          letter-spacing: -0.01em;
        }
        h3 {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
        }
        .card {
          border: 1px solid rgba(168, 175, 255, 0.14);
          border-radius: 20px;
          background: linear-gradient(170deg, rgba(22, 24, 39, 0.94), rgba(15, 16, 29, 0.94));
          box-shadow: 0 10px 26px rgba(3, 5, 18, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.05);
          padding: 20px;
        }
        .profileCard {
          display: grid;
          gap: 4px;
        }
        .heroCard {
          display: grid;
          gap: 14px;
          border-color: rgba(146, 124, 255, 0.46);
          background:
            linear-gradient(180deg, rgba(34, 24, 63, 0.72), rgba(19, 21, 36, 0.95)),
            linear-gradient(120deg, rgba(116, 91, 255, 0.18), rgba(194, 83, 255, 0.12));
        }
        .heroHeaderRow {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          flex-wrap: wrap;
        }
        .heroKicker {
          border: 1px solid rgba(205, 197, 255, 0.45);
          border-radius: 999px;
          padding: 7px 12px;
          font-size: 12px;
          color: rgba(245, 242, 255, 0.94);
          background: rgba(157, 125, 255, 0.22);
        }
        .sectionCard {
          display: grid;
          gap: 14px;
        }
        .classSwitcherCard {
          background: #ffffff;
          color: #1a1a1a;
          border-color: rgba(52, 59, 93, 0.14);
          box-shadow: 0 8px 20px rgba(19, 25, 52, 0.1);
        }
        .commandGrid {
          display: grid;
          gap: 12px;
        }
        .commandPrimary {
          border-radius: 14px;
          border: 1px solid rgba(183, 170, 255, 0.35);
          background: rgba(103, 86, 184, 0.18);
          padding: 14px;
          display: grid;
          gap: 10px;
        }
        .commandClassName {
          font-size: 30px;
          line-height: 1.05;
          font-weight: 800;
          letter-spacing: -0.02em;
        }
        .innerCard {
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: #ffffff;
          color: #1a1a1a;
          padding: 14px;
          display: grid;
          gap: 10px;
          box-shadow: 0 8px 18px rgba(19, 25, 52, 0.08);
        }
        .cardEyebrow {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(224, 228, 255, 0.8);
        }
        .signedInName {
          font-size: 18px;
          font-weight: 700;
        }
        .signedInMeta {
          font-size: 15px;
          color: rgba(235, 239, 255, 0.84);
        }
        .helperText,
        .statusText {
          margin: 0;
          color: rgba(232, 236, 255, 0.96);
          font-size: 15px;
        }
        .microCopy {
          font-size: 12px;
        }
        .stackForm {
          display: grid;
          gap: 10px;
        }
        .lessonForm {
          gap: 12px;
        }
        label,
        .detailLabel {
          font-size: 15px;
          color: rgba(245, 247, 255, 0.96);
          font-weight: 600;
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
          border: 1px solid rgba(90, 102, 146, 0.28);
          background: #ffffff;
          color: #1a1a1a;
        }
        :global(.teacherPage input::placeholder),
        :global(.teacherPage textarea::placeholder) {
          color: rgba(61, 70, 105, 0.68);
        }
        :global(.teacherPage select) {
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          background-image: linear-gradient(45deg, transparent 50%, rgba(228, 232, 255, 0.95) 50%),
            linear-gradient(135deg, rgba(228, 232, 255, 0.95) 50%, transparent 50%);
          background-position: calc(100% - 18px) calc(50% - 3px), calc(100% - 12px) calc(50% - 3px);
          background-size: 6px 6px, 6px 6px;
          background-repeat: no-repeat;
          padding-right: 34px;
        }
        :global(.teacherPage select option) {
          background: #ffffff;
          color: #1a1a1a;
        }
        .primaryButton,
        .secondaryButton {
          padding: 11px 15px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.12s ease, filter 0.12s ease, background 0.12s ease;
        }
        .primaryButton {
          border: 1px solid rgba(181, 176, 255, 0.62);
          color: #ffffff;
          background: linear-gradient(135deg, #7a69ff 0%, #9258ff 55%, #5d7cff 100%);
          box-shadow: 0 0 26px rgba(138, 98, 255, 0.33);
        }
        .assignButton {
          font-size: 15px;
          padding: 13px 16px;
        }
        .secondaryButton {
          border: 1px solid rgba(214, 218, 240, 0.9);
          color: #1a1a1a;
          background: #ffffff;
        }
        .copyButton {
          width: fit-content;
        }
        .primaryButton:hover,
        .secondaryButton:hover {
          filter: brightness(1.08);
        }
        .primaryButton:active,
        .secondaryButton:active {
          transform: translateY(1px);
        }
        .primaryButton:disabled,
        .secondaryButton:disabled {
          opacity: 0.72;
          cursor: not-allowed;
          box-shadow: none;
        }
        .classList {
          display: grid;
          gap: 8px;
        }
        .compactClassList {
          grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
        }
        .rowButton {
          text-align: left;
          padding: 12px;
          border-radius: 11px;
          border: 1px solid rgba(114, 122, 160, 0.24);
          background: #ffffff;
          color: #1a1a1a;
          cursor: pointer;
        }
        .classRowButton {
          display: grid;
          gap: 2px;
        }
        .rowButton:hover {
          background: #f7f8ff;
        }
        .selected {
          background: #f0eeff;
          border-color: rgba(128, 111, 255, 0.68);
          box-shadow: 0 0 0 1px rgba(140, 122, 255, 0.22);
        }
        .rowTitle,
        .detailValue {
          font-size: 15px;
          font-weight: 700;
        }
        .rowSubtext {
          font-size: 13px;
          color: #2e3352;
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
          color: rgba(235, 239, 255, 0.95);
        }
        .selectionPill {
          font-size: 13px;
          font-weight: 700;
          border-radius: 999px;
          border: 1px solid rgba(176, 159, 255, 0.66);
          background: rgba(126, 95, 255, 0.25);
          padding: 6px 12px;
        }
        .detailGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }
        .detailItem {
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          padding: 10px;
          background: rgba(255, 255, 255, 0.04);
          display: grid;
          gap: 4px;
        }
        .classCodeCard {
          border-radius: 14px;
          border: 1px solid rgba(190, 170, 255, 0.54);
          background: linear-gradient(145deg, rgba(113, 95, 255, 0.34), rgba(140, 70, 214, 0.26));
          padding: 14px;
          display: grid;
          gap: 8px;
        }
        .classCodeValue {
          font-size: 31px;
          line-height: 1;
          letter-spacing: 0.08em;
          font-weight: 800;
        }
        .studentGrid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 12px;
        }
        .studentTile {
          border-radius: 12px;
          border: 1px solid rgba(181, 188, 216, 0.8);
          background: #ffffff;
          padding: 14px 16px;
          min-height: 62px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          box-shadow: 0 4px 12px rgba(17, 25, 46, 0.08);
          transition: border-color 0.12s ease, background 0.12s ease, box-shadow 0.12s ease, transform 0.12s ease;
        }
        .studentTile:hover {
          background: #f7f8ff;
          border-color: rgba(128, 111, 255, 0.42);
          box-shadow: 0 8px 16px rgba(42, 52, 86, 0.12);
        }
        .studentTile :global(input) {
          width: 18px;
          height: 18px;
          margin: 0;
          accent-color: #6f57ff;
          flex: 0 0 auto;
        }
        .studentName {
          font-size: 17px;
          line-height: 1.3;
          font-weight: 700;
          color: #1a1a1a;
          overflow-wrap: anywhere;
        }
        .lessonShell {
          background: linear-gradient(180deg, rgba(23, 19, 44, 0.92), rgba(17, 18, 34, 0.95));
          border-color: rgba(145, 129, 255, 0.36);
        }
        .lessonSurface {
          background: #ffffff;
          color: #1a1a1a;
          border-color: rgba(200, 207, 232, 0.9);
          box-shadow: 0 8px 20px rgba(19, 25, 52, 0.08);
        }
        .adminSection {
          border-color: rgba(255, 255, 255, 0.16);
          background: rgba(16, 18, 31, 0.9);
        }
        .adminGrid {
          display: grid;
          gap: 12px;
        }

        .studentTile.selected {
          background: #f0eeff;
          border-color: rgba(117, 97, 255, 0.8);
          box-shadow: 0 0 0 1px rgba(131, 114, 255, 0.25), 0 8px 16px rgba(42, 52, 86, 0.14);
        }
        .classSwitcherCard .statusText,
        .classSwitcherCard .helperText,
        .lessonSurface .helperText,
        .innerCard .statusText,
        .innerCard .helperText,
        .innerCard .detailLabel,
        .innerCard .detailValue,
        .innerCard h3,
        .innerCard label,
        .innerCard .rowTitle,
        .innerCard .rowSubtext {
          color: #1a1a1a;
        }
        .classSwitcherCard .selectionCount {
          color: #2e3352;
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
          .commandGrid {
            grid-template-columns: 1.25fr 0.75fr;
          }
          .adminGrid {
            grid-template-columns: 0.95fr 1.05fr;
          }
        }

        @media (max-width: 760px) {
          .detailGrid {
            grid-template-columns: 1fr;
          }
          .classCodeValue {
            font-size: 26px;
          }
        }
      `}</style>
    </main>
  )
}

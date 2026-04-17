import { useEffect, useState } from 'react'
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
  const [studentSupportSelections, setStudentSupportSelections] = useState({})
  const [isRosterCollapsed, setIsRosterCollapsed] = useState(false)

  const [lessonTitle, setLessonTitle] = useState('')
  const [lessonText, setLessonText] = useState('')
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

  const selectedCount = Object.keys(studentSupportSelections).length
  const supportCounts = Object.values(studentSupportSelections).reduce(
    (counts, level) => ({
      ...counts,
      [level]: (counts[level] || 0) + 1,
    }),
    {}
  )
  console.log('[DEBUG] selectedClass:', selectedClass)

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
      setStudentSupportSelections({})
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
      setStudentSupportSelections({})
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
      setStudentSupportSelections({})
      setLoadingStudents(false)
      return
    }

    const nextStudents = Array.isArray(payload?.students) ? payload.students : []

    setStudents(nextStudents)
    setStudentSupportSelections({})
    setIsRosterCollapsed(false)
    setLoadingStudents(false)
  }

  function handleSelectClass(classRow) {
    setSelectedClass(classRow)
    setCopiedCode(false)
    setStudents([])
    setStudentSupportSelections({})
    setIsRosterCollapsed(false)
  }

  function handleSelectStudentSupport(studentId, supportLevel) {
    setStudentSupportSelections((previous) => ({
      ...previous,
      [studentId]: supportLevel,
    }))
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

    const assignmentRows = Object.entries(studentSupportSelections).map(([studentId, mode]) => ({
      lesson_id: createdLesson.id,
      student_id: Number(studentId),
      mode,
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
    setStudentSupportSelections({})
    setLessonTitle('')
    setLessonText('')
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
                    <p className="helperText">Pick one support level per student to include them in the assignment.</p>
                  </div>
                  <div className="studentHeaderActions">
                    <span className="selectionPill">{selectedCount} selected</span>
                    {selectedCount > 0 && !isRosterCollapsed ? (
                      <button type="button" className="secondaryButton rosterToggleButton" onClick={() => setIsRosterCollapsed(true)}>
                        Collapse roster
                      </button>
                    ) : null}
                  </div>
                </div>

                {loadingStudents ? <p className="statusText">Loading students...</p> : null}
                {!loadingStudents && students.length === 0 ? <p className="statusText">No students enrolled in this class yet.</p> : null}

                {!loadingStudents && students.length > 0 && isRosterCollapsed ? (
                  <div className="rosterSummaryBar">
                    <span className="summaryTotal">{selectedCount} assigned student{selectedCount === 1 ? '' : 's'}</span>
                    {supportCounts.remediation ? <span className="summaryChip remediation">Remediation: {supportCounts.remediation}</span> : null}
                    {supportCounts['on-level'] ? <span className="summaryChip onLevel">On-Level: {supportCounts['on-level']}</span> : null}
                    {supportCounts.enrichment ? <span className="summaryChip enrichment">Enrichment: {supportCounts.enrichment}</span> : null}
                    <button type="button" className="secondaryButton rosterToggleButton" onClick={() => setIsRosterCollapsed(false)}>
                      Edit roster
                    </button>
                  </div>
                ) : null}

                {!loadingStudents && students.length > 0 && !isRosterCollapsed ? (
                  <>
                    <div className="studentGrid">
                      {students.map((student) => {
                        const selectedSupport = studentSupportSelections[student.id]

                        return (
                          <div key={student.id} className={selectedSupport ? 'studentTile selected' : 'studentTile'}>
                            <span className="studentName">{getStudentName(student)}</span>
                            <div className="supportButtonRow">
                              <button
                                type="button"
                                className={selectedSupport === 'remediation' ? 'supportButton remediation isActive' : 'supportButton remediation'}
                                onClick={() => handleSelectStudentSupport(student.id, 'remediation')}
                              >
                                Remediation
                              </button>
                              <button
                                type="button"
                                className={selectedSupport === 'on-level' ? 'supportButton onLevel isActive' : 'supportButton onLevel'}
                                onClick={() => handleSelectStudentSupport(student.id, 'on-level')}
                              >
                                On-Level
                              </button>
                              <button
                                type="button"
                                className={selectedSupport === 'enrichment' ? 'supportButton enrichment isActive' : 'supportButton enrichment'}
                                onClick={() => handleSelectStudentSupport(student.id, 'enrichment')}
                              >
                                Enrichment
                              </button>
                            </div>
                          </div>
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
                  <p className="helperText">Build the task and assign to students using each student&apos;s selected support level.</p>
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

                    <p className="helperText microCopy">Support level is selected per student in the roster above.</p>
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
          font-family: Inter, system-ui, sans-serif;
          min-height: 100vh;
          background: #f9fafb;
          color: #111827;
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
          font-size: 28px;
          line-height: 1.15;
          font-weight: 700;
          color: #111827;
        }
        h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: #111827;
        }
        h3 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: #111827;
        }
        .card {
          border: 1px solid #e5e7eb;
          border-radius: 20px;
          background: #ffffff;
          box-shadow: 0 8px 20px rgba(17, 24, 39, 0.06);
          padding: 20px;
        }
        .profileCard {
          display: grid;
          gap: 4px;
        }
        .heroCard {
          display: grid;
          gap: 14px;
        }
        .heroHeaderRow {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          flex-wrap: wrap;
        }
        .heroKicker {
          border: 1px solid #d1d5db;
          border-radius: 999px;
          padding: 7px 12px;
          font-size: 14px;
          color: #4b5563;
          background: #f3f4f6;
        }
        .sectionCard {
          display: grid;
          gap: 14px;
        }
        .classSwitcherCard {
          background: #ffffff;
          color: #111827;
          border-color: #e5e7eb;
          box-shadow: 0 8px 20px rgba(17, 24, 39, 0.06);
        }
        .commandGrid {
          display: grid;
          gap: 12px;
        }
        .commandPrimary {
          border-radius: 14px;
          border: 1px solid #e5e7eb;
          background: #ffffff;
          padding: 16px;
          display: grid;
          gap: 10px;
          box-shadow: 0 6px 16px rgba(17, 24, 39, 0.05);
        }
        .commandClassName {
          font-size: 24px;
          line-height: 1.15;
          font-weight: 700;
          color: #111827;
        }
        .innerCard {
          border-radius: 14px;
          border: 1px solid #e5e7eb;
          background: #ffffff;
          color: #111827;
          padding: 16px;
          display: grid;
          gap: 10px;
          box-shadow: 0 8px 20px rgba(17, 24, 39, 0.06);
        }
        .cardEyebrow {
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #9ca3af;
        }
        .signedInName {
          font-size: 17px;
          font-weight: 500;
          color: #111827;
        }
        .signedInMeta {
          font-size: 14px;
          color: #4b5563;
        }
        .helperText,
        .statusText {
          margin: 0;
          color: #4b5563;
          font-size: 14px;
        }
        .microCopy {
          font-size: 14px;
          color: #9ca3af;
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
          font-size: 14px;
          color: #4b5563;
          font-weight: 500;
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
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #111827;
        }
        :global(.teacherPage input::placeholder),
        :global(.teacherPage textarea::placeholder) {
          color: #9ca3af;
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
          color: #111827;
        }
        .primaryButton,
        .secondaryButton {
          padding: 11px 15px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.12s ease, filter 0.12s ease, background 0.12s ease;
        }
        .primaryButton {
          border: 1px solid #6d28d9;
          color: #ffffff;
          background: linear-gradient(135deg, #6d28d9 0%, #7c3aed 50%, #8b5cf6 100%);
          box-shadow: 0 10px 20px rgba(109, 40, 217, 0.28);
        }
        .assignButton {
          font-size: 15px;
          padding: 13px 16px;
        }
        .secondaryButton {
          border: 1px solid #d1d5db;
          color: #374151;
          background: #f3f4f6;
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
          padding: 14px;
          border-radius: 11px;
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #111827;
          cursor: pointer;
        }
        .classRowButton {
          display: grid;
          gap: 2px;
        }
        .rowButton:hover {
          background: #f9fafb;
        }
        .selected {
          background: #f5f3ff;
          border-color: #a78bfa;
          box-shadow: 0 0 0 1px rgba(124, 58, 237, 0.2);
        }
        .rowTitle,
        .detailValue {
          font-size: 16px;
          font-weight: 500;
          color: #111827;
        }
        .rowSubtext {
          font-size: 14px;
          color: #4b5563;
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
          color: #4b5563;
        }
        .selectionPill {
          font-size: 14px;
          font-weight: 700;
          border-radius: 999px;
          border: 1px solid #c4b5fd;
          background: #f5f3ff;
          color: #6d28d9;
          padding: 6px 12px;
        }
        .studentHeaderActions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .rosterToggleButton {
          padding: 8px 12px;
          font-size: 13px;
        }
        .rosterSummaryBar {
          border: 1px solid #ddd6fe;
          background: #faf5ff;
          border-radius: 12px;
          padding: 12px;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }
        .summaryTotal {
          font-size: 14px;
          font-weight: 700;
          color: #5b21b6;
          margin-right: 4px;
        }
        .summaryChip {
          border-radius: 999px;
          padding: 5px 10px;
          font-size: 12px;
          font-weight: 700;
          border: 1px solid #d1d5db;
          background: #ffffff;
        }
        .summaryChip.remediation {
          border-color: #fca5a5;
          color: #991b1b;
        }
        .summaryChip.onLevel {
          border-color: #86efac;
          color: #166534;
        }
        .summaryChip.enrichment {
          border-color: #c4b5fd;
          color: #5b21b6;
        }
        .detailGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }
        .detailItem {
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          padding: 10px;
          background: #ffffff;
          display: grid;
          gap: 4px;
        }
        .classCodeCard {
          border-radius: 14px;
          border: 1px solid #e5e7eb;
          background: #ffffff;
          padding: 16px;
          display: grid;
          gap: 8px;
          box-shadow: 0 6px 16px rgba(17, 24, 39, 0.05);
        }
        .classCodeValue {
          font-size: 28px;
          line-height: 1;
          letter-spacing: 0.08em;
          font-weight: 800;
          color: #111827;
        }
        .studentGrid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 12px;
        }
        .studentTile {
          border-radius: 12px;
          border: 1px solid #d1d5db;
          background: #ffffff;
          padding: 16px;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          justify-content: flex-start;
          gap: 0;
          min-height: 108px;
          box-shadow: 0 6px 14px rgba(17, 24, 39, 0.06);
          transition: border-color 0.12s ease, background 0.12s ease, box-shadow 0.12s ease, transform 0.12s ease;
        }
        .studentTile:hover {
          background: #fafafa;
          border-color: #c4b5fd;
          box-shadow: 0 8px 16px rgba(17, 24, 39, 0.08);
        }
        .studentName {
          font-size: 16.5px;
          line-height: 1.35;
          font-weight: 600;
          color: #111827;
          overflow-wrap: anywhere;
          margin-bottom: 12px;
        }
        .supportButtonRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: nowrap;
          gap: 8px;
          width: 100%;
        }
        .supportButton {
          border: 1px solid #d1d5db;
          border-radius: 10px;
          background: #ffffff;
          color: #111827;
          padding: 9px 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          flex: 1;
          transition: transform 0.12s ease, border-color 0.12s ease, background 0.12s ease, box-shadow 0.12s ease;
        }
        .supportButton:hover {
          transform: translateY(-1px);
        }
        .supportButton.remediation {
          border-color: #fca5a5;
          color: #991b1b;
        }
        .supportButton.onLevel {
          border-color: #86efac;
          color: #166534;
        }
        .supportButton.enrichment {
          border-color: #c4b5fd;
          color: #5b21b6;
        }
        .supportButton.remediation.isActive {
          background: #dc2626;
          border-color: #dc2626;
          color: #ffffff;
          box-shadow: 0 0 0 1px rgba(220, 38, 38, 0.25);
        }
        .supportButton.onLevel.isActive {
          background: #16a34a;
          border-color: #16a34a;
          color: #ffffff;
          box-shadow: 0 0 0 1px rgba(22, 163, 74, 0.25);
        }
        .supportButton.enrichment.isActive {
          background: #7c3aed;
          border-color: #7c3aed;
          color: #ffffff;
          box-shadow: 0 0 0 1px rgba(124, 58, 237, 0.25);
        }
        .lessonShell {
          background: #ffffff;
          border-color: #e5e7eb;
        }
        .lessonSurface {
          background: #ffffff;
          color: #111827;
          border-color: #e5e7eb;
          box-shadow: 0 8px 20px rgba(17, 24, 39, 0.06);
        }
        .adminSection {
          border-color: #e5e7eb;
          background: #ffffff;
        }
        .adminGrid {
          display: grid;
          gap: 12px;
        }

        .studentTile.selected {
          background: #faf7ff;
          border-color: #7c3aed;
          box-shadow: 0 0 0 1px rgba(124, 58, 237, 0.35), 0 10px 22px rgba(124, 58, 237, 0.12);
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
          color: #111827;
        }
        .classSwitcherCard .selectionCount {
          color: #4b5563;
        }
        .errorText {
          color: #b91c1c;
          margin: 0;
          line-height: 1.45;
          font-size: 14px;
        }
        .noticeText {
          color: #166534;
          margin: 0;
          line-height: 1.45;
          font-size: 14px;
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

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import VICHeader from '../components/VICHeader'

const REDIRECT_DELAY_MS = 1200
const ASSIGNABLE_SUPPORT_LEVELS = ['remediation', 'core', 'enrichment']

function getUserDisplayName(userRow) {
  if (!userRow) return ''

  return userRow.name || userRow.email || ''
}

function normalizeSupportLevel(value) {
  if (value === 'on-level' || value === 'on_level') return 'core'
  if (ASSIGNABLE_SUPPORT_LEVELS.includes(value)) return value
  return null
}

function getStoredSupportLevel(value) {
  const normalizedLevel = normalizeSupportLevel(value)
  if (!normalizedLevel) return null
  return normalizedLevel === 'core' ? 'on_level' : normalizedLevel
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
    const initialSelections = nextStudents.reduce((accumulator, student) => {
      if (!student?.id) return accumulator
      const normalizedLevel = normalizeSupportLevel(student.support_level)
      if (normalizedLevel) {
        accumulator[student.id] = normalizedLevel
      }
      return accumulator
    }, {})
    setStudentSupportSelections(initialSelections)
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

  async function handleSelectStudentSupport(studentId, supportLevel) {
    if (!selectedClass?.id || !studentId) return

    const previousSupportLevel = studentSupportSelections[studentId]

    setStudentSupportSelections((previous) => ({
      ...previous,
      [studentId]: supportLevel,
    }))

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session?.access_token) {
      setError('Please sign in again to save support levels.')
      setStudentSupportSelections((previous) => ({
        ...previous,
        [studentId]: previousSupportLevel,
      }))
      return
    }

    const response = await fetch('/api/teacher/update-support-level', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        classId: selectedClass.id,
        studentId,
        supportLevel,
      }),
    })

    if (response.ok) {
      setStudents((previous) =>
        previous.map((student) =>
          student?.id === studentId
            ? {
                ...student,
                support_level: getStoredSupportLevel(supportLevel),
              }
            : student
        )
      )
      return
    }

    const payload = await response.json().catch(() => null)
    setError(payload?.error || 'Could not save support level for this student.')
    setStudentSupportSelections((previous) => ({
      ...previous,
      [studentId]: previousSupportLevel,
    }))
  }

  function handleSelectGroup(groupKey) {
    if (!Array.isArray(students) || students.length === 0) return

    if (groupKey === 'clear') {
      setStudentSupportSelections({})
      return
    }

    const nextSelections = students.reduce((accumulator, student) => {
      if (!student?.id) return accumulator

      const normalizedLevel = normalizeSupportLevel(student.support_level) || 'core'

      if (groupKey === 'all' || groupKey === normalizedLevel) {
        accumulator[student.id] = normalizedLevel
      }

      return accumulator
    }, {})

    setStudentSupportSelections(nextSelections)
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
      mode: mode === 'core' ? 'on-level' : mode,
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
                    {supportCounts.core ? <span className="summaryChip onLevel">Core: {supportCounts.core}</span> : null}
                    {supportCounts.enrichment ? <span className="summaryChip enrichment">Enrichment: {supportCounts.enrichment}</span> : null}
                    <button type="button" className="secondaryButton rosterToggleButton" onClick={() => setIsRosterCollapsed(false)}>
                      Edit roster
                    </button>
                  </div>
                ) : null}

                {!loadingStudents && students.length > 0 && !isRosterCollapsed ? (
                  <>
                    <div className="groupSelectionRow">
                      <button type="button" className="secondaryButton groupButton" onClick={() => handleSelectGroup('remediation')}>
                        Select Remediation
                      </button>
                      <button type="button" className="secondaryButton groupButton" onClick={() => handleSelectGroup('core')}>
                        Select On-Level
                      </button>
                      <button type="button" className="secondaryButton groupButton" onClick={() => handleSelectGroup('enrichment')}>
                        Select Enrichment
                      </button>
                      <button type="button" className="secondaryButton groupButton" onClick={() => handleSelectGroup('all')}>
                        Select All Students
                      </button>
                      <button type="button" className="secondaryButton groupButton" onClick={() => handleSelectGroup('clear')}>
                        Clear Selection
                      </button>
                    </div>
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
                                title="Remediation"
                              >
                                Rem
                              </button>
                              <button
                                type="button"
                                className={selectedSupport === 'core' ? 'supportButton onLevel isActive' : 'supportButton onLevel'}
                                onClick={() => handleSelectStudentSupport(student.id, 'core')}
                                title="Core"
                              >
                                Core
                              </button>
                              <button
                                type="button"
                                className={selectedSupport === 'enrichment' ? 'supportButton enrichment isActive' : 'supportButton enrichment'}
                                onClick={() => handleSelectStudentSupport(student.id, 'enrichment')}
                                title="Enrichment"
                              >
                                Enr
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
          background: var(--vic-bg);
          color: var(--vic-text-primary);
          padding: 30px 16px 54px;
        }
        .teacherShell {
          max-width: 1180px;
          margin: 0 auto;
          display: grid;
          gap: 22px;
        }
        h1 {
          margin: 0;
          font-size: 34px;
          line-height: 1.08;
          font-weight: 800;
          color: var(--vic-text-primary);
        }
        h2 {
          margin: 0;
          font-size: 25px;
          font-weight: 750;
          color: var(--vic-text-primary);
        }
        h3 {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
          color: var(--vic-text-primary);
        }
        .card {
          border: 1px solid transparent;
          border-radius: 14px;
          background: var(--vic-surface);
          box-shadow: var(--vic-shadow-card);
          padding: 24px;
        }
        .profileCard {
          display: grid;
          gap: 6px;
          box-shadow: none;
          background: transparent;
          border-color: transparent;
          padding: 0 2px;
        }
        .heroCard {
          display: grid;
          gap: 18px;
          border-color: transparent;
          box-shadow: var(--vic-shadow-raised);
        }
        .heroHeaderRow {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          flex-wrap: wrap;
        }
        .heroKicker {
          border: 1px solid var(--vic-border-soft);
          border-radius: 10px;
          padding: 7px 12px;
          font-size: 14px;
          color: var(--vic-text-secondary);
          background: var(--vic-surface-muted);
        }
        .sectionCard {
          display: grid;
          gap: 18px;
        }
        .classSwitcherCard {
          background: var(--vic-surface);
          color: var(--vic-text-primary);
          border-color: var(--vic-border);
          box-shadow: none;
        }
        .commandGrid {
          display: grid;
          gap: 12px;
        }
        .commandPrimary {
          border-radius: 14px;
          border: 1px solid transparent;
          background: var(--vic-surface);
          padding: 16px;
          display: grid;
          gap: 10px;
          box-shadow: var(--vic-shadow-soft);
        }
        .commandClassName {
          font-size: 28px;
          line-height: 1.08;
          font-weight: 800;
          color: var(--vic-text-primary);
        }
        .innerCard {
          border-radius: 12px;
          border: 1px solid transparent;
          background: var(--vic-surface);
          color: var(--vic-text-primary);
          padding: 18px;
          display: grid;
          gap: 10px;
          box-shadow: none;
        }
        .cardEyebrow {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--vic-text-secondary);
        }
        .signedInName {
          font-size: 18px;
          font-weight: 650;
          color: var(--vic-text-primary);
        }
        .signedInMeta {
          font-size: 13px;
          color: var(--vic-text-secondary);
        }
        .helperText,
        .statusText {
          margin: 0;
          color: var(--vic-text-secondary);
          font-size: 15px;
        }
        .microCopy {
          font-size: 12px;
          color: var(--vic-text-secondary);
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
          font-size: 13px;
          color: var(--vic-text-secondary);
          font-weight: 500;
        }
        :global(.teacherPage input),
        :global(.teacherPage textarea),
        :global(.teacherPage select),
        :global(.teacherPage button) {
          font: inherit;
          border-radius: 10px;
        }
        :global(.teacherPage input),
        :global(.teacherPage textarea),
        :global(.teacherPage select) {
          width: 100%;
          padding: 12px 14px;
          border: 1px solid transparent;
          background: var(--vic-surface);
          color: var(--vic-text-primary);
        }
        :global(.teacherPage input::placeholder),
        :global(.teacherPage textarea::placeholder) {
          color: var(--vic-disabled);
        }
        :global(.teacherPage select) {
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          background-image: linear-gradient(45deg, transparent 50%, rgba(217, 203, 190, 0.95) 50%),
            linear-gradient(135deg, rgba(217, 203, 190, 0.95) 50%, transparent 50%);
          background-position: calc(100% - 18px) calc(50% - 3px), calc(100% - 12px) calc(50% - 3px);
          background-size: 6px 6px, 6px 6px;
          background-repeat: no-repeat;
          padding-right: 34px;
        }
        :global(.teacherPage select option) {
          background: var(--vic-surface);
          color: var(--vic-text-primary);
        }
        .primaryButton,
        .secondaryButton {
          padding: 10px 14px;
          font-weight: 800;
          cursor: pointer;
          transition: transform 0.12s ease, filter 0.12s ease, background 0.12s ease;
        }
        .primaryButton {
          border: 1px solid var(--vic-primary);
          color: var(--vic-surface);
          background: var(--vic-primary);
          box-shadow: 0 10px 22px rgba(181, 83, 47, 0.24);
        }
        .assignButton {
          font-size: 15px;
          padding: 13px 16px;
        }
        .secondaryButton {
          border: 1px solid var(--vic-border);
          color: var(--vic-text-secondary);
          background: var(--vic-surface-muted);
        }
        .copyButton {
          width: fit-content;
        }
        .primaryButton:hover,
        .secondaryButton:hover {
          filter: brightness(1.04);
          transform: translateY(-1px);
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
          border: 1px solid transparent;
          background: var(--vic-surface);
          color: var(--vic-text-primary);
          cursor: pointer;
        }
        .classRowButton {
          display: grid;
          gap: 2px;
        }
        .rowButton:hover {
          background: var(--vic-bg);
        }
        .selected {
          background: #E8D8C8;
          border-color: rgba(150, 69, 40, 0.72);
          box-shadow: 0 0 0 1px rgba(181, 83, 47, 0.18);
        }
        .rowTitle,
        .detailValue {
          font-size: 16px;
          font-weight: 500;
          color: var(--vic-text-primary);
        }
        .rowSubtext {
          font-size: 14px;
          color: var(--vic-text-secondary);
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
          color: var(--vic-text-secondary);
        }
        .selectionPill {
          font-size: 14px;
          font-weight: 800;
          border-radius: 10px;
          border: 1px solid var(--vic-primary-soft);
          background: var(--vic-primary-soft);
          color: var(--vic-primary);
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
          border: 1px solid var(--vic-primary-soft);
          background: var(--vic-primary-soft);
          border-radius: 10px;
          padding: 12px;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }
        .summaryTotal {
          font-size: 14px;
          font-weight: 800;
          color: var(--vic-primary-hover);
          margin-right: 4px;
        }
        .summaryChip {
          border-radius: 10px;
          padding: 5px 10px;
          font-size: 12px;
          font-weight: 800;
          border: 1px solid var(--vic-border-soft);
          background: var(--vic-surface);
        }
        .summaryChip.remediation {
          border-color: var(--vic-danger-soft);
          color: var(--vic-danger);
        }
        .summaryChip.onLevel {
          border-color: var(--vic-success-soft);
          color: var(--vic-success);
        }
        .summaryChip.enrichment {
          border-color: var(--vic-primary-soft);
          color: var(--vic-primary-hover);
        }
        .detailGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }
        .detailItem {
          border-radius: 10px;
          border: 1px solid var(--vic-border-soft);
          padding: 10px;
          background: var(--vic-surface);
          display: grid;
          gap: 6px;
        }
        .classCodeCard {
          border-radius: 14px;
          border: 1px solid transparent;
          background: var(--vic-surface);
          padding: 16px;
          display: grid;
          gap: 8px;
          box-shadow: var(--vic-shadow-soft);
        }
        .classCodeValue {
          font-size: 32px;
          line-height: 1;
          letter-spacing: 0.08em;
          font-weight: 800;
          color: var(--vic-text-primary);
        }
        .groupSelectionRow {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;
        }
        .groupButton {
          padding: 8px 12px;
          font-size: 13px;
        }
        .studentGrid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 12px;
        }
        .studentTile {
          border-radius: 10px;
          border: 1px solid transparent;
          background: var(--vic-surface);
          padding: 16px;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          justify-content: flex-start;
          gap: 0;
          min-height: 98px;
          box-shadow: 0 6px 14px rgba(17, 24, 39, 0.06);
          transition: border-color 0.12s ease, background 0.12s ease, box-shadow 0.12s ease, transform 0.12s ease;
        }
        .studentTile:hover {
          background: #fafafa;
          border-color: var(--vic-primary-soft);
          box-shadow: 0 8px 16px rgba(17, 24, 39, 0.08);
        }
        .studentName {
          font-size: 16.5px;
          line-height: 1.35;
          font-weight: 600;
          color: var(--vic-text-primary);
          overflow-wrap: anywhere;
          margin-bottom: 12px;
        }
        .supportButtonRow {
          display: flex;
          align-items: center;
          justify-content: stretch;
          flex-wrap: nowrap;
          gap: 8px;
          width: 100%;
          min-width: 0;
        }
        .supportButton {
          border: 1px solid var(--vic-border);
          border-radius: 10px;
          background: var(--vic-surface-muted);
          color: var(--vic-text-primary);
          padding: 9px 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          flex: 1 1 0;
          min-width: 0;
          text-align: center;
          white-space: nowrap;
          transition: transform 0.12s ease, border-color 0.12s ease, background 0.12s ease, box-shadow 0.12s ease;
        }
        .supportButton:hover {
          transform: translateY(-1px);
        }
        .supportButton.remediation {
          border-color: var(--vic-danger-soft);
          color: var(--vic-danger);
        }
        .supportButton.onLevel {
          border-color: var(--vic-success-soft);
          color: var(--vic-success);
        }
        .supportButton.enrichment {
          border-color: var(--vic-primary-soft);
          color: var(--vic-primary-hover);
        }
        .supportButton.remediation.isActive {
          background: var(--vic-danger);
          border-color: var(--vic-danger);
          color: var(--vic-surface);
          box-shadow: 0 0 0 1px rgba(161, 77, 58, 0.25);
        }
        .supportButton.onLevel.isActive {
          background: var(--vic-success);
          border-color: var(--vic-success);
          color: var(--vic-surface);
          box-shadow: 0 0 0 1px rgba(94, 124, 90, 0.25);
        }
        .supportButton.enrichment.isActive {
          background: var(--vic-primary);
          border-color: var(--vic-primary);
          color: var(--vic-surface);
          box-shadow: 0 0 0 1px rgba(181, 83, 47, 0.25);
        }
        .lessonShell {
          background: transparent;
          border-color: transparent;
          box-shadow: none;
          padding: 4px 0 0;
        }
        .lessonSurface {
          background: var(--vic-surface);
          color: var(--vic-text-primary);
          border-color: var(--vic-border);
          box-shadow: none;
        }
        .adminSection {
          border-color: transparent;
          background: transparent;
          box-shadow: none;
          padding: 6px 0 0;
        }
        .adminGrid {
          display: grid;
          gap: 12px;
        }

        .studentTile.selected {
          background: var(--vic-surface-muted);
          border-color: var(--vic-primary);
          box-shadow: 0 0 0 1px rgba(181, 83, 47, 0.22), 0 12px 24px rgba(181, 83, 47, 0.14);
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
          color: var(--vic-text-primary);
        }
        .classSwitcherCard .selectionCount {
          color: var(--vic-text-secondary);
        }
        .errorText {
          color: var(--vic-danger);
          margin: 0;
          line-height: 1.45;
          font-size: 14px;
        }
        .noticeText {
          color: var(--vic-success);
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

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import VICHeader from '../components/VICHeader'
import VICLogo from '../components/VICLogo'
import { lessonFromAssignment, pickLatestAssignment } from '../lib/assignment-resolution'

const BRAIN_VERSION = 'v3.3'
const SKETCH_BG_COLOR = '#f8fafc'
const SKETCH_INK_COLOR = '#0f172a'

const INITIAL_MESSAGES = [
  {
    role: 'assistant',
    text:
      'Let’s start learning 👇\n\nTry something like:\n• "Help me understand fractions"\n• "Give me a reading passage"\n\nChoose a quick start below or type your own question.',
    visual: { type: 'idle', title: 'Visual Support' },
  },
]

const ASSIGNED_LESSON_READY_MESSAGE = (lessonTitle) => ({
  role: 'assistant',
  text: `Your teacher assigned "${lessonTitle || 'a lesson'}." Send any message when you're ready to begin.`,
  visual: { type: 'tip', title: 'Assigned lesson ready' },
})

const ASSIGNED_LESSON_INTEREST_PROMPT_MESSAGE = {
  role: 'assistant',
  text: 'Before we start, what is one personal interest you enjoy (for example: soccer, music, art, animals, or games)?',
  visual: { type: 'tip', title: 'One quick question' },
}

const GUIDED_ENTRY_OPTIONS = [
  {
    id: 'homework_help',
    label: 'Get Homework Help',
    prompt: 'I need help with homework. Please coach me step by step and check my understanding as we go.',
  },
  {
    id: 'start_lesson',
    label: 'Start a Lesson',
    prompt: 'I want to start a lesson. Please choose a focused starting point and teach me one clear step at a time.',
  },
  {
    id: 'practice_skill',
    label: 'Practice a Skill',
    prompt: 'I want to practice a skill. Give me one short practice problem and coach me through it like a teacher.',
  },
]

let browserSupabaseClient = null

function getBrowserSupabaseClient() {
  if (typeof window === 'undefined') return null
  if (browserSupabaseClient) return browserSupabaseClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseKey) return null

  browserSupabaseClient = createClient(supabaseUrl, supabaseKey)
  return browserSupabaseClient
}

function getEntryModeMeta({ hasAssignedLesson, hasUserMessages, sessionMode }) {
  if (sessionMode === 'teacher_directed' && hasAssignedLesson && !hasUserMessages) {
    return {
      label: 'Teacher Lesson',
      helper: "Your teacher has picked today's lesson. Send an opening line to begin.",
    }
  }

  if (sessionMode === 'teacher_directed' && hasAssignedLesson && hasUserMessages) {
    return {
      label: 'Teacher Lesson In Progress',
      helper: "VIC is following your teacher's lesson and guiding you step by step.",
    }
  }

  return {
    label: 'My Own Work',
    helper: 'Choose a quick start below or type your own question.',
  }
}

function normalizeGradeLevel(rawGradeLevel) {
  if (!rawGradeLevel && rawGradeLevel !== 0) return ''
  return String(rawGradeLevel).trim()
}

function normalizeSupportLevel(rawLevel) {
  if (typeof rawLevel !== 'string') return ''

  const value = rawLevel.trim().toLowerCase()

  if (value === 'on-level' || value === 'on_level') return 'core'
  if (value === 'remediation' || value === 'core' || value === 'enrichment') return value

  return ''
}

function normalizeUserRole(rawRole) {
  if (typeof rawRole !== 'string') return ''
  return rawRole.trim().toLowerCase()
}

function cleanLessonTitle(rawTitle) {
  if (typeof rawTitle !== 'string') return ''
  const title = rawTitle.trim()
  if (!title) return ''

  const normalized = title.toLowerCase()
  if (
    normalized === 'your assigned lesson' ||
    normalized === 'teacher-selected lesson' ||
    normalized === 'a lesson'
  ) {
    return ''
  }

  return title
}

function titleFromAssignmentRow(assignmentRow) {
  if (!assignmentRow) return ''
  const nestedLesson =
    lessonFromAssignment(assignmentRow) ||
    assignmentRow.lesson ||
    assignmentRow.lesson_row ||
    null

  return (
    cleanLessonTitle(nestedLesson?.title) ||
    cleanLessonTitle(assignmentRow.lesson_title) ||
    cleanLessonTitle(assignmentRow.title) ||
    ''
  )
}

function debugAskVicStudentResolution(label, payload = {}) {
  if (typeof window === 'undefined') return
  console.log(`[AskVIC][student-resolution] ${label}`, payload)
}

function getUserDisplayName(userRow) {
  if (!userRow) return ''

  return userRow.name || userRow.email || ''
}

async function resolveUserProfileRow(supabase, user) {
  const authUserId = user?.id || ''
  const rawEmail = user?.email || ''
  const normalizedEmail = rawEmail.trim().toLowerCase()

  if (authUserId) {
    const { data: byAuthUserRows } = await supabase
      .from('users')
      .select('id, auth_user_id, email, name, role, interest_tags')
      .eq('auth_user_id', authUserId)
      .order('id', { ascending: true })
      .limit(1)

    if (byAuthUserRows?.[0]) {
      return byAuthUserRows[0]
    }
  }

  if (!normalizedEmail) return null

  const { data: byEmailRows } = await supabase
    .from('users')
    .select('id, auth_user_id, email, name, role, interest_tags')
    .ilike('email', normalizedEmail)
    .order('id', { ascending: true })
    .limit(1)

  return byEmailRows?.[0] || null
}

async function loadLatestAssignmentSafe(supabase, studentId, accessToken) {
  const apiDebug = {
    status: null,
    ok: null,
    responseJson: null,
    error: null,
  }

  if (accessToken) {
    try {
      const response = await fetch('/api/student/latest-assignment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ studentId }),
      })

      const payload = await response.json().catch(() => null)
      apiDebug.status = response.status
      apiDebug.ok = response.ok
      apiDebug.responseJson = payload

      if (response.ok) {
        return { rows: Array.isArray(payload?.rows) ? payload.rows : [], error: null, apiDebug }
      }
    } catch (error) {
      apiDebug.error = error?.message || 'Unknown fetch error'
    }
  }

  const assignmentQueryPlans = [
    {
      select:
        'id, mode, assigned_at, created_at, lesson_id, lessons:lesson_id (id, subject, title, lesson_text, is_active)',
      orderByCreatedAt: true,
    },
    {
      select: 'id, mode, assigned_at, lesson_id, lessons:lesson_id (id, subject, title, lesson_text, is_active)',
      orderByCreatedAt: false,
    },
    {
      select: 'id, mode, assigned_at, created_at, lesson_id',
      orderByCreatedAt: true,
    },
    {
      select: 'id, mode, assigned_at, lesson_id',
      orderByCreatedAt: false,
    },
  ]

  for (const plan of assignmentQueryPlans) {
    let query = supabase
      .from('assignments')
      .select(plan.select)
      .eq('student_id', studentId)
      .order('assigned_at', { ascending: false, nullsFirst: false })

    if (plan.orderByCreatedAt) {
      query = query.order('created_at', { ascending: false, nullsFirst: false })
    }

    query = query.order('id', { ascending: false }).limit(20)

    const { data, error } = await query

    if (!error) {
      return { rows: Array.isArray(data) ? data : [], error: null, apiDebug }
    }
  }

  return {
    rows: [],
    error: new Error('Could not load assignments with available schema.'),
    apiDebug,
  }
}

export default function AskVIC() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [workArea, setWorkArea] = useState('')
  const [notes, setNotes] = useState('')
  const [activeTool, setActiveTool] = useState('practice')
  const [sketchExpanded, setSketchExpanded] = useState(false)
  const [sketchMinimized, setSketchMinimized] = useState(false)
  const [calcInput, setCalcInput] = useState('')
  const [calcResult, setCalcResult] = useState('')
  const [viewportWidth, setViewportWidth] = useState(1400)
  const [selectedStudentId, setSelectedStudentId] = useState(null)
  const [assignedLesson, setAssignedLesson] = useState(null)
  const [hasTeacherAssignment, setHasTeacherAssignment] = useState(false)
  const [studentMode, setStudentMode] = useState('')
  const [studentSupportLevel, setStudentSupportLevel] = useState('')
  const [studentInterest, setStudentInterest] = useState('')
  const [studentGradeLevel, setStudentGradeLevel] = useState('')
  const [studentLookupStatus, setStudentLookupStatus] = useState('Loading student...')
  const [sessionMode, setSessionMode] = useState('student_directed')
  const [messages, setMessages] = useState(INITIAL_MESSAGES)
  const [currentUserProfile, setCurrentUserProfile] = useState(null)
  const [currentUserStatus, setCurrentUserStatus] = useState('Loading signed-in user...')
  const [awaitingAssignedLessonInterest, setAwaitingAssignedLessonInterest] = useState(false)
  const [pendingEntryIntent, setPendingEntryIntent] = useState('')
  const [debugAuthUserId, setDebugAuthUserId] = useState(null)
  const [debugAuthEmail, setDebugAuthEmail] = useState(null)
  const [debugResolvedUserId, setDebugResolvedUserId] = useState(null)
  const [debugResolvedRole, setDebugResolvedRole] = useState(null)
  const [debugLatestAssignment, setDebugLatestAssignment] = useState({
    found: false,
    id: null,
    lessonId: null,
    lessonTitle: null,
  })
  const [debugLatestAssignmentApi, setDebugLatestAssignmentApi] = useState({
    status: null,
    ok: null,
    responseJson: null,
    error: null,
  })
  const [isDebugPanelOpen, setIsDebugPanelOpen] = useState(false)

  const resolvedAssignedLessonTitle = cleanLessonTitle(assignedLesson?.title)

  const lessonStatusText = hasTeacherAssignment
    ? `Assigned lesson: ${resolvedAssignedLessonTitle || 'Teacher-selected lesson'}`
    : studentLookupStatus === 'Loading student...'
      ? 'Checking your student profile...'
      : studentLookupStatus === 'Student detected. No assigned lesson found.'
        ? 'No assigned lesson right now. You can ask VIC anything.'
        : studentLookupStatus === 'Signed in as non-student. Ask VIC is in free mode.'
          ? 'Free Ask VIC is ready.'
          : studentLookupStatus === 'Could not match your student profile. Using free mode.'
            ? 'Student profile not found. Free Ask VIC is ready.'
            : studentLookupStatus

  const hasUserMessages = messages.some((message) => message.role === 'user')
  const hasAssignedLesson = hasTeacherAssignment
  const teacherLessonDisabled = !hasAssignedLesson
  const teacherLessonDisabledReason = teacherLessonDisabled
    ? hasTeacherAssignment
      ? 'teacher_assignment_flag_false_mismatch'
      : 'no_teacher_assignment_resolved'
    : 'enabled'
  const entryModeMeta = getEntryModeMeta({
    hasAssignedLesson,
    hasUserMessages,
    sessionMode,
  })
  const debugValue = (value) => {
    if (value === null || value === undefined || value === '') return '—'
    if (typeof value === 'boolean') return value ? 'true' : 'false'
    return String(value)
  }
  const debugJsonValue = (value) => {
    if (value === null || value === undefined) return '—'
    try {
      return JSON.stringify(value)
    } catch (_error) {
      return '[unserializable JSON]'
    }
  }

  useEffect(() => {
    debugAskVicStudentResolution('final-state', {
      selectedStudentId,
      hasTeacherAssignment,
      assignedLesson,
      sessionMode,
      teacherLessonDisabled,
      teacherLessonDisabledReason,
      studentLookupStatus,
    })
  }, [
    assignedLesson,
    hasTeacherAssignment,
    selectedStudentId,
    sessionMode,
    studentLookupStatus,
    teacherLessonDisabled,
    teacherLessonDisabledReason,
  ])

  function handleSessionModeToggle(nextMode) {
    if (nextMode === sessionMode) return
    if (nextMode === 'teacher_directed' && !hasAssignedLesson) return
    setSessionMode(nextMode)
  }

  const messageAreaRef = useRef(null)
  const messageRefs = useRef([])
  const canvasRef = useRef(null)
  const isDrawingRef = useRef(false)
  const isErasingRef = useRef(false)
  const assignmentIntroKeyRef = useRef('')

  const detectStudentAndLesson = useCallback(async () => {
      debugAskVicStudentResolution('detect-start', {})
      setStudentLookupStatus('Loading student...')
      setCurrentUserStatus('Loading signed-in user...')
      setDebugAuthUserId(null)
      setDebugAuthEmail(null)
      setDebugResolvedUserId(null)
      setDebugResolvedRole(null)
      setDebugLatestAssignment({ found: false, id: null, lessonId: null, lessonTitle: null })
      setDebugLatestAssignmentApi({ status: null, ok: null, responseJson: null, error: null })

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

      if (!supabaseUrl || !supabaseKey) {
        debugAskVicStudentResolution('supabase-not-configured', {})
        setCurrentUserProfile(null)
        setCurrentUserStatus('Supabase is not configured.')
        setSelectedStudentId(null)
        setAssignedLesson(null)
        setHasTeacherAssignment(false)
        assignmentIntroKeyRef.current = ''
        setSessionMode('student_directed')
        setStudentSupportLevel('')
        setStudentGradeLevel('')
        setAwaitingAssignedLessonInterest(false)
        setStudentLookupStatus('Supabase is not configured. Ask VIC is in free mode.')
        return
      }

      const supabase = getBrowserSupabaseClient()
      if (!supabase) {
        setCurrentUserProfile(null)
        setCurrentUserStatus('Supabase is not configured.')
        setSelectedStudentId(null)
        setAssignedLesson(null)
        setHasTeacherAssignment(false)
        assignmentIntroKeyRef.current = ''
        setSessionMode('student_directed')
        setStudentSupportLevel('')
        setStudentGradeLevel('')
        setAwaitingAssignedLessonInterest(false)
        setStudentLookupStatus('Supabase is not configured. Ask VIC is in free mode.')
        return
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user?.email) {
        debugAskVicStudentResolution('auth-user-missing', {
          userError: userError?.message || null,
          authUserId: user?.id || null,
          authEmail: user?.email || null,
        })
        setCurrentUserProfile(null)
        setDebugAuthUserId(user?.id || null)
        setDebugAuthEmail(user?.email || null)
        setDebugResolvedUserId(null)
        setDebugResolvedRole(null)
        setCurrentUserStatus('No signed-in user found.')
        setSelectedStudentId(null)
        setAssignedLesson(null)
        setHasTeacherAssignment(false)
        assignmentIntroKeyRef.current = ''
        setSessionMode('student_directed')
        setStudentSupportLevel('')
        setStudentGradeLevel('')
        setAwaitingAssignedLessonInterest(false)
        setStudentLookupStatus('No student found. You can still chat with VIC.')
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()
      const accessToken = session?.access_token || ''

      const matchedProfile = await resolveUserProfileRow(supabase, user)
      debugAskVicStudentResolution('auth-and-profile', {
        authUserId: user?.id || null,
        authEmail: user?.email || null,
        resolvedUserId: matchedProfile?.id || null,
        resolvedUserRoleRaw: matchedProfile?.role || null,
      })
      setCurrentUserProfile(matchedProfile)
      setDebugAuthUserId(user?.id || null)
      setDebugAuthEmail(user?.email || null)
      setDebugResolvedUserId(matchedProfile?.id || null)
      setCurrentUserStatus(
        matchedProfile
          ? 'Signed in.'
          : 'Signed in user found, but no matching profile row in public.users.'
      )

      const resolvedRole = normalizeUserRole(
        matchedProfile?.role || user?.user_metadata?.role || user?.app_metadata?.role || ''
      )
      setDebugResolvedRole(resolvedRole || null)

      debugAskVicStudentResolution('resolved-role', {
        matchedProfileRole: matchedProfile?.role || null,
        userMetadataRole: user?.user_metadata?.role || null,
        appMetadataRole: user?.app_metadata?.role || null,
        resolvedRole,
      })

      if (resolvedRole && resolvedRole !== 'student') {
        debugAskVicStudentResolution('non-student-role-branch', {
          resolvedRole,
        })
        setSelectedStudentId(null)
        setAssignedLesson(null)
        setHasTeacherAssignment(false)
        assignmentIntroKeyRef.current = ''
        setSessionMode('student_directed')
        setStudentSupportLevel('')
        setStudentGradeLevel('')
        setAwaitingAssignedLessonInterest(false)
        setStudentLookupStatus('Signed in as non-student. Ask VIC is in free mode.')
        return
      }

      const student = matchedProfile

      if (!student?.id) {
        debugAskVicStudentResolution('student-profile-not-found', {
          authUserId: user?.id || null,
          authEmail: user?.email || null,
        })
        setSelectedStudentId(null)
        setAssignedLesson(null)
        setHasTeacherAssignment(false)
        assignmentIntroKeyRef.current = ''
        setSessionMode('student_directed')
        setStudentSupportLevel('')
        setStudentGradeLevel('')
        setAwaitingAssignedLessonInterest(false)
        setStudentLookupStatus('Could not match your student profile. Using free mode.')
        return
      }

      setSelectedStudentId(student.id)
      debugAskVicStudentResolution('student-selected', {
        selectedStudentId: student.id,
      })
      const interests = Array.isArray(student.interest_tags) ? student.interest_tags : []
      setStudentInterest(interests.join(', '))

      const { data: enrollmentRows } = await supabase
        .from('enrollments')
        .select('class_id, support_level, classes:class_id(grade_level)')
        .eq('student_id', student.id)
        .order('class_id', { ascending: true })

      const safeEnrollmentRows = Array.isArray(enrollmentRows) ? enrollmentRows : []
      const firstEnrollment = safeEnrollmentRows[0] || null
      const firstClassRow = Array.isArray(firstEnrollment?.classes)
        ? firstEnrollment.classes[0]
        : firstEnrollment?.classes
      setStudentGradeLevel(normalizeGradeLevel(firstClassRow?.grade_level))

      const { rows: assignmentRows, error: assignmentError, apiDebug } = await loadLatestAssignmentSafe(
        supabase,
        student.id,
        accessToken
      )
      setDebugLatestAssignmentApi(apiDebug || { status: null, ok: null, responseJson: null, error: null })
      debugAskVicStudentResolution('assignment-query-result', {
        assignmentError: assignmentError?.message || null,
        assignmentRowCount: Array.isArray(assignmentRows) ? assignmentRows.length : 0,
        assignmentRowsPreview: Array.isArray(assignmentRows) ? assignmentRows.slice(0, 3) : [],
        latestAssignmentApiStatus: apiDebug?.status ?? null,
        latestAssignmentApiOk: typeof apiDebug?.ok === 'boolean' ? apiDebug.ok : null,
        latestAssignmentApiResponseJson: apiDebug?.responseJson ?? null,
        latestAssignmentApiError: apiDebug?.error ?? null,
      })

      const latestAssignment = pickLatestAssignment(assignmentRows)
      let lessonRow = lessonFromAssignment(latestAssignment)
      setDebugLatestAssignment({
        found: Boolean(latestAssignment?.id),
        id: latestAssignment?.id || null,
        lessonId: latestAssignment?.lesson_id || lessonRow?.id || null,
        lessonTitle: lessonRow?.title || null,
      })

      debugAskVicStudentResolution('assignment-selected', {
        latestAssignment,
        lessonFromAssignment: lessonRow,
      })

      if (latestAssignment?.id && !lessonRow && latestAssignment?.lesson_id) {
        const { data: fallbackLessonRows } = await supabase
          .from('lessons')
          .select('id, subject, title, lesson_text, is_active')
          .eq('id', latestAssignment.lesson_id)
          .order('id', { ascending: true })
          .limit(1)

        lessonRow = fallbackLessonRows?.[0] || null
        setDebugLatestAssignment({
          found: Boolean(latestAssignment?.id),
          id: latestAssignment?.id || null,
          lessonId: latestAssignment?.lesson_id || lessonRow?.id || null,
          lessonTitle: lessonRow?.title || null,
        })
        debugAskVicStudentResolution('assignment-lesson-fallback', {
          lessonId: latestAssignment.lesson_id,
          fallbackLessonFound: Boolean(lessonRow),
          fallbackLesson: lessonRow,
        })
      }

      if (assignmentError || !latestAssignment?.id || !lessonRow) {
        debugAskVicStudentResolution('assignment-not-fully-resolved', {
          assignmentError: assignmentError?.message || null,
          hasLatestAssignment: Boolean(latestAssignment?.id),
          hasLessonRow: Boolean(lessonRow),
        })
        if (latestAssignment?.id) {
          const fallbackLessonTitle = titleFromAssignmentRow(latestAssignment)
          setAssignedLesson({
            id: latestAssignment.lesson_id || null,
            subject: '',
            title: fallbackLessonTitle,
            lesson_text: '',
          })
          setHasTeacherAssignment(true)
          setStudentMode(latestAssignment.mode || '')
          setStudentSupportLevel(normalizeSupportLevel(latestAssignment.mode || ''))
          setSessionMode('teacher_directed')
          setAwaitingAssignedLessonInterest(false)
          const fallbackIntroKey = `assignment:${latestAssignment.id || 'unknown'}:ready`
          if (assignmentIntroKeyRef.current !== fallbackIntroKey) {
            assignmentIntroKeyRef.current = fallbackIntroKey
            setMessages((prev) =>
              prev.some((message) => message.role === 'user')
                ? prev
                : [ASSIGNED_LESSON_READY_MESSAGE(fallbackLessonTitle || 'your assigned lesson')]
            )
          }
          setStudentLookupStatus('Teacher lesson found and ready.')
          return
        }

        setAssignedLesson(null)
        setHasTeacherAssignment(false)
        assignmentIntroKeyRef.current = ''
        setStudentMode('')
        setStudentSupportLevel('')
        setSessionMode('student_directed')
        setAwaitingAssignedLessonInterest(false)
        setStudentLookupStatus('Student detected. No assigned lesson found.')
        return
      }

      let enrollmentSupportLevel = ''
      const normalizedAssignmentMode = normalizeSupportLevel(latestAssignment.mode || '')

      if (safeEnrollmentRows.length === 1) {
        enrollmentSupportLevel = normalizeSupportLevel(safeEnrollmentRows[0]?.support_level)
      } else if (safeEnrollmentRows.length > 1 && normalizedAssignmentMode) {
        const matchedEnrollment = safeEnrollmentRows.find(
          (row) => normalizeSupportLevel(row?.support_level) === normalizedAssignmentMode
        )
        enrollmentSupportLevel = normalizeSupportLevel(matchedEnrollment?.support_level)
      }

      const resolvedSupportLevel =
        enrollmentSupportLevel || normalizedAssignmentMode || normalizeSupportLevel(latestAssignment.mode || '')

      setAssignedLesson(lessonRow)
      setHasTeacherAssignment(true)
      setStudentMode(latestAssignment.mode || '')
      setStudentSupportLevel(resolvedSupportLevel)
      setSessionMode('teacher_directed')
      const hasInterest = Boolean(interests.join(', ').trim())
      if (hasInterest) {
        setAwaitingAssignedLessonInterest(false)
        const introKey = `assignment:${latestAssignment.id}:ready`
        if (assignmentIntroKeyRef.current !== introKey) {
          assignmentIntroKeyRef.current = introKey
          setMessages((prev) =>
            prev.some((message) => message.role === 'user')
              ? prev
              : [ASSIGNED_LESSON_READY_MESSAGE(cleanLessonTitle(lessonRow.title) || 'your assigned lesson')]
          )
        }
      } else {
        setAwaitingAssignedLessonInterest(true)
        const introKey = `assignment:${latestAssignment.id}:interest`
        if (assignmentIntroKeyRef.current !== introKey) {
          assignmentIntroKeyRef.current = introKey
          setMessages((prev) =>
            prev.some((message) => message.role === 'user')
              ? prev
              : [ASSIGNED_LESSON_INTEREST_PROMPT_MESSAGE]
          )
        }
      }
      setStudentLookupStatus(`Loaded assigned lesson: ${lessonRow.title || 'Untitled lesson'}`)
      debugAskVicStudentResolution('assignment-resolved-success', {
        selectedStudentId: student.id,
        latestAssignment,
        lessonRow,
        hasTeacherAssignment: true,
        assignedLesson: lessonRow,
        sessionMode: 'teacher_directed',
      })
  }, [])

  useEffect(() => {
    let active = true
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

    const runDetection = async () => {
      if (!active) return
      await detectStudentAndLesson()
    }

    runDetection()

    const sharedSupabase = getBrowserSupabaseClient()
    const authSubscription = sharedSupabase?.auth.onAuthStateChange(() => {
      runDetection()
    })

    const handleWindowFocus = () => {
      runDetection()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runDetection()
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleWindowFocus)
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }

    return () => {
      active = false
      authSubscription?.data?.subscription?.unsubscribe()
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleWindowFocus)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    }
  }, [detectStudentAndLesson])

  useEffect(() => {
    const updateViewport = () => {
      if (typeof window !== 'undefined') {
        setViewportWidth(window.innerWidth)
      }
    }

    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  const isMobile = viewportWidth <= 768
  const isTablet = viewportWidth > 768 && viewportWidth <= 1100
  const isCompact = viewportWidth <= 1100

  useEffect(() => {
    if (activeTool !== 'sketch') return

    const canvas = canvasRef.current
    if (!canvas) return

    const syncCanvasSize = () => {
      const rect = canvas.getBoundingClientRect()
      const width = Math.max(Math.floor(rect.width), 1)
      const height = Math.max(Math.floor(rect.height), 1)

      if (canvas.width === width && canvas.height === height) return

      const snapshot = document.createElement('canvas')
      snapshot.width = canvas.width || width
      snapshot.height = canvas.height || height
      const snapshotCtx = snapshot.getContext('2d')
      if (snapshotCtx && canvas.width && canvas.height) {
        snapshotCtx.drawImage(canvas, 0, 0)
      }

      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = SKETCH_BG_COLOR
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      if (snapshot.width && snapshot.height) {
        ctx.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, width, height)
      }
    }

    const raf = window.requestAnimationFrame(syncCanvasSize)
    window.addEventListener('resize', syncCanvasSize)

    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('resize', syncCanvasSize)
    }
}, [activeTool, isCompact, isMobile, viewportWidth, sketchExpanded])

  useEffect(() => {
    const container = messageAreaRef.current
    if (!container) return

    const lastMessage = messageRefs.current[messages.length - 1]
    if (!lastMessage) return

    const containerRect = container.getBoundingClientRect()
    const messageRect = lastMessage.getBoundingClientRect()
    const currentScroll = container.scrollTop
    const offsetTop = messageRect.top - containerRect.top + currentScroll
    const targetTop = Math.max(offsetTop - 16, 0)

    container.scrollTo({
      top: targetTop,
      behavior: 'smooth',
    })
  }, [messages])

  async function sendMessage(customMessage) {
    const outgoing =
      typeof customMessage === 'string'
        ? customMessage
        : customMessage?.text || input
    const sketchImage =
      typeof customMessage === 'object' && customMessage?.sketchImage
        ? customMessage.sketchImage
        : null

    const trimmedOutgoing = outgoing.trim()
    const missingState = {
      missingInput: !trimmedOutgoing,
      loadingInProgress: loading,
      missingUserSession: !currentUserProfile && currentUserStatus !== 'Signed in.',
      missingStudentMode: !studentMode,
      missingSessionMode: !sessionMode,
      missingSelectedStudentInTeacherMode: sessionMode === 'teacher_directed' && !selectedStudentId,
      missingAssignedLessonInTeacherMode: sessionMode === 'teacher_directed' && !assignedLesson,
      missingAssignedLessonSubjectInTeacherMode:
        sessionMode === 'teacher_directed' && !assignedLesson?.subject,
      missingAssignedLessonTextInTeacherMode:
        sessionMode === 'teacher_directed' && !assignedLesson?.lesson_text,
    }

    console.log('[AskVIC][sendMessage] handler start', {
      inputText: outgoing,
      trimmedInputText: trimmedOutgoing,
      hasCustomMessage: typeof customMessage !== 'undefined',
      missingState,
    })

    if (!trimmedOutgoing || loading) {
      console.log('[AskVIC][sendMessage] early return before send', {
        reason: !trimmedOutgoing ? 'empty_input' : 'loading_state',
        inputText: outgoing,
        missingState,
      })
      return null
    }

    const userTextForThread = sketchImage ? `${outgoing}

[Sketch attached]` : outgoing
    const userMessage = { role: 'user', text: userTextForThread }
    const nextMessages = [...messages, userMessage]
    const isFirstUserTurn = !messages.some((message) => message.role === 'user')

    setMessages([
      ...nextMessages,
      {
        role: 'assistant',
        text: 'VIC is thinking...',
      },
    ])

    setLoading(true)
    setInput('')

    try {
      if (sessionMode === 'teacher_directed' && assignedLesson && awaitingAssignedLessonInterest) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        const normalizedInterest = trimmedOutgoing.replace(/\s+/g, ' ').trim()
        const sharedSupabase = getBrowserSupabaseClient()

        if (supabaseUrl && supabaseKey && sharedSupabase && selectedStudentId && normalizedInterest) {
          const { error: updateInterestError } = await sharedSupabase
            .from('users')
            .update({ interest_tags: [normalizedInterest] })
            .eq('id', selectedStudentId)

          if (updateInterestError) {
            console.error('[AskVIC][sendMessage] failed to save student interest', updateInterestError)
          } else {
            setStudentInterest(normalizedInterest)
          }
        }
        if (!studentInterest) {
          setStudentInterest(normalizedInterest)
        }

        setAwaitingAssignedLessonInterest(false)

        const apiMessages = [
          ...nextMessages.map((msg) => ({ role: msg.role, content: msg.text })),
          {
            role: 'user',
            content: `The student just shared this personal interest: "${normalizedInterest}". Start the assigned lesson now. Use that interest naturally while teaching, and do not ask onboarding questions.`,
          },
        ]

        const requestBody = {
          messages: apiMessages,
          studentId: selectedStudentId,
          sessionMode,
          studentInterest: normalizedInterest,
          gradeLevel: studentGradeLevel,
          entryIntent: pendingEntryIntent || null,
          isFirstUserTurn,
        }

        if (sessionMode === 'teacher_directed') {
          requestBody.assignedLesson = assignedLesson
          requestBody.studentMode = studentMode
          requestBody.supportLevel = studentSupportLevel
        }

        const res = await fetch('/api/vic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })

        if (!res.ok) {
          throw new Error(`API error: ${res.status}`)
        }

        const data = await res.json()
        const finalReply = data.reply || 'No reply'
        const visual = inferVisualFromConversation(outgoing, finalReply)

        setMessages([
          ...nextMessages,
          {
            role: 'assistant',
            text: finalReply,
            visual,
          },
        ])
        setPendingEntryIntent('')

        return finalReply
      }

      const apiMessages = nextMessages.map((msg) => ({
        role: msg.role,
        content: msg.text,
      }))

      const apiUrl = '/api/vic'
      console.log('[AskVIC][sendMessage] about to fetch', {
        url: apiUrl,
        inputText: outgoing,
        missingState,
        payloadPreview: {
          messagesCount: apiMessages.length,
          hasSketchImage: Boolean(sketchImage),
          studentId: selectedStudentId,
          sessionMode,
          hasAssignedLesson: Boolean(assignedLesson),
          studentMode,
          studentSupportLevel,
          studentInterest,
          studentGradeLevel,
        },
      })

      const requestBody = {
        messages: apiMessages,
        sketchImage,
        studentId: selectedStudentId,
        sessionMode,
        studentInterest,
        gradeLevel: studentGradeLevel,
        entryIntent: pendingEntryIntent || null,
        isFirstUserTurn,
      }

      if (sessionMode === 'teacher_directed') {
        requestBody.assignedLesson = assignedLesson
        requestBody.studentMode = studentMode
        requestBody.supportLevel = studentSupportLevel
      }

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      console.log('[AskVIC][sendMessage] fetch returned', {
        url: apiUrl,
        ok: res.ok,
        status: res.status,
      })
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`)
      }

      const data = await res.json()
      const finalReply = data.reply || 'No reply'
      const visual = inferVisualFromConversation(outgoing, finalReply)

      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          text: finalReply,
          visual,
        },
      ])
      setPendingEntryIntent('')

      return finalReply
    } catch (error) {
      console.error('[AskVIC][sendMessage] caught error', {
        error,
        inputText: outgoing,
        missingState,
      })
      const errorReply = 'Something went wrong. Please try again.'
      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          text: errorReply,
          visual: {
            type: 'tip',
            title: 'Quick fix',
            body: 'Try sending the message again. If it keeps happening, check the API route or OpenAI response.',
          },
        },
      ])
      return errorReply
    } finally {
      setLoading(false)
    }
  }

  function handleGuidedEntry(option) {
    if (!option) return
    setPendingEntryIntent(option.id)
    setInput(option.prompt)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function runCalculator() {
    try {
      const safe = calcInput.replace(/[^0-9+\-*/(). ]/g, '')
      if (!safe.trim()) {
        setCalcResult('')
        return
      }
      const result = Function(`"use strict"; return (${safe})`)()
      setCalcResult(String(result))
    } catch {
      setCalcResult('Invalid calculation')
    }
  }


  function startCanvasStroke(e) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY
    const ctx = canvas.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = isErasingRef.current ? 18 : 3
    ctx.strokeStyle = isErasingRef.current ? SKETCH_BG_COLOR : SKETCH_INK_COLOR
    isDrawingRef.current = true
  }

  function moveCanvasStroke(e) {
    if (!isDrawingRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY
    const ctx = canvas.getContext('2d')
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function stopCanvasStroke() {
    isDrawingRef.current = false
  }

  function setCanvasMode(mode) {
    isErasingRef.current = mode === 'erase'
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = SKETCH_BG_COLOR
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  async function discussSketch() {
    const canvas = canvasRef.current
    if (!canvas) return

    const sketchImage = canvas.toDataURL('image/png')
    await sendMessage({
      text:
        'Look at my sketch and respond like a calm teacher. First describe what you see in simple terms. Then tell me what looks correct, what might need fixing, and what I should try next.',
      sketchImage,
    })
  }

  function sendWorkspacePrompt(prompt) {
    setInput(prompt)
  }

  function requestHint() {
    const context =
      activeTool === 'practice'
        ? workArea.trim()
        : activeTool === 'notes'
          ? notes.trim()
          : ''

    const prompt = context
      ? `Give me a hint without giving away the full answer. Here is what I have so far:\n\n${context}`
      : activeTool === 'sketch'
        ? 'Help me think through my sketch. Ask me to describe what I drew and then guide me from there.'
        : 'Give me a hint for the problem I am working on without giving away the full answer.'

    sendWorkspacePrompt(prompt)
  }

  async function requestAskVICAboutThis() {
    const context =
      activeTool === 'practice'
        ? workArea.trim()
        : activeTool === 'notes'
          ? notes.trim()
          : ''

    if (!context) {
      const fallbackPrompt =
        activeTool === 'notes'
          ? 'I do not have notes written yet. Help me decide what notes I should take next.'
          : 'I do not have work written yet. Help me get started step by step.'

      await sendMessage(fallbackPrompt)
      return
    }

    const prompt =
      activeTool === 'notes'
        ? `Here are my notes. Respond like a patient teacher. Help me understand them, point out anything important or missing, and give me one next step:

${context}`
        : `Here is my work. Respond like a patient teacher. Say what is correct, what needs fixing, and give me one next step:

${context}`

    await sendMessage(prompt)
  }

    const styles = buildStyles({ isMobile, isTablet, isCompact, sketchExpanded, sketchMinimized })

  const heroSection = (
    <section style={styles.heroCard}>
      <div style={styles.heroSparkle} />

      <div style={styles.heroTop}>
        <VICLogo size={isMobile ? 92 : 96} variant="hero" alt="VIC Virtual Co-Teacher logo" />

        <div style={styles.heroTextWrap}>
          <div style={styles.versionPill}>Brain {BRAIN_VERSION}</div>
          <h1 style={styles.heading}>More than answers. Real teaching.</h1>
          <p style={styles.tagline}>
            Guided help that feels calm, clear, and personal.
          </p>
        </div>
      </div>
    </section>
  )


  const toolsSection = (
    <section style={styles.toolsCard}>
      <div style={styles.toolsHeaderRow}>
        <div style={styles.toolsHeaderText}>
          <div style={styles.sectionEyebrow}>Workspace</div>
          <div style={styles.sectionTitle}>Student Tools</div>
          <div style={styles.toolsSubtext}>Work while VIC teaches.</div>
        </div>
      </div>

      <div style={styles.toolTabsStickyWrap}>
        <div style={styles.toolTabsWrap}>
          <button
            style={activeTool === 'practice' ? styles.toolTabActive : styles.toolTab}
            onClick={() => setActiveTool('practice')}
          >
            Practice
          </button>
          <button
            style={activeTool === 'sketch' ? styles.toolTabActive : styles.toolTab}
            onClick={() => setActiveTool('sketch')}
          >
            Sketch
          </button>
          <button
            style={activeTool === 'notes' ? styles.toolTabActive : styles.toolTab}
            onClick={() => setActiveTool('notes')}
          >
            Notes
          </button>
          <button
            style={activeTool === 'calculator' ? styles.toolTabActive : styles.toolTab}
            onClick={() => setActiveTool('calculator')}
          >
            Calc
          </button>
        </div>
      </div>

      {activeTool === 'practice' ? (
        <div style={styles.workspacePanel}>
          <div style={styles.practiceHeaderRow}>
            <div style={styles.miniLabelDarkText}>Practice</div>
            <div style={styles.practiceHintDarkText}>Work out your thinking here.</div>
          </div>

          <textarea
            value={workArea}
            onChange={(e) => setWorkArea(e.target.value)}
            placeholder="Work out your thinking here..."
            style={styles.sideTextarea}
          />
        </div>
      ) : null}

      {activeTool === 'sketch' ? (
        <div style={styles.workspacePanel}>
          <div style={styles.practiceHeaderRow}>
            <div style={styles.miniLabelDarkText}>Sketch</div>
            <div style={styles.practiceHintDarkText}>
              Draw a model, label a science idea, or sketch out a math problem.
            </div>
          </div>

          <div style={styles.sketchToolbar}>
            <button style={styles.sketchToolButton} onClick={() => setCanvasMode('draw')}>
              Pen
            </button>
            <button style={styles.sketchToolButton} onClick={() => setCanvasMode('erase')}>
              Erase
            </button>
            <button style={styles.sketchToolButton} onClick={clearCanvas}>
              Clear
            </button>
          </div>
                   {!sketchExpanded ? (
            <div style={styles.sketchCanvasWrap}>
              <button
                type="button"
                style={styles.sketchCornerExpandButton}
                onClick={() => setSketchExpanded(true)}
                aria-label="Open large sketch pad"
                title="Open large sketch pad"
              >
                ↗
              </button>

              <canvas
                ref={canvasRef}
                style={styles.sketchCanvas}
                onPointerDown={startCanvasStroke}
                onPointerMove={moveCanvasStroke}
                onPointerUp={stopCanvasStroke}
                onPointerLeave={stopCanvasStroke}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTool === 'notes' ? (
        <div style={styles.workspacePanel}>
          <div style={styles.practiceHeaderRow}>
            <div style={styles.miniLabelDarkText}>Notes</div>
            <div style={styles.practiceHintDarkText}>Save the important ideas cleanly here.</div>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Save important ideas here..."
            style={styles.notesTextareaLarge}
          />
        </div>
      ) : null}

      {activeTool === 'notes' ? (
        <div style={styles.supportRowTwoUp}>
          <button style={styles.supportButtonWhite} onClick={requestHint}>
            Hint
          </button>
          <button style={styles.supportButtonWhiteStrong} onClick={requestAskVICAboutThis}>
            Ask VIC About This
          </button>
        </div>
      ) : null}

      {activeTool === 'calculator' ? (
        <div style={styles.workspacePanel}>
          <div style={styles.practiceHeaderRow}>
            <div style={styles.miniLabelDarkText}>Calculator</div>
            <div style={styles.practiceHintDarkText}>Use it when it helps — not before you think.</div>
          </div>

          <div style={styles.toolPanelWhite}>
            <input
              value={calcInput}
              onChange={(e) => setCalcInput(e.target.value)}
              placeholder="Example: 12 * (4 + 3)"
              style={styles.calcInput}
            />
            <div style={styles.calcRow}>
              <button style={styles.smallButtonDark} onClick={runCalculator}>
                Calculate
              </button>
              <div style={styles.calcResultDark}>{calcResult || 'Result will appear here.'}</div>
            </div>
          </div>
        </div>
      ) : null}

      {activeTool === 'practice' ? (
        <div style={styles.supportRowTwoUp}>
          <button style={styles.supportButtonWhite} onClick={requestHint}>
            Hint
          </button>
          <button style={styles.supportButtonWhiteStrong} onClick={requestAskVICAboutThis}>
            Ask VIC About This
          </button>
        </div>
      ) : null}

      {activeTool === 'sketch' ? (
        <div style={styles.supportRowTwoUp}>
          <button style={styles.supportButtonWhite} onClick={requestHint}>
            Hint
          </button>
          <button style={styles.supportButtonWhiteStrong} onClick={discussSketch}>
            Discuss My Sketch
          </button>
        </div>
      ) : null}

      <div style={styles.reportFeatureCardCompact}>
        <div style={styles.reportFeatureLabelCompact}>Session Report</div>
        <div style={styles.reportFeatureTitleCompact}>Session Report for teachers</div>
        <div style={styles.reportFeatureTextCompact}>
          After each session, teachers can review and send a summary to families from the Teacher Dashboard.
        </div>
        <div style={styles.reportFeatureHintCompact}>Look for Report controls in each student's session view.</div>
      </div>
    </section>
  )

  return (
    <div style={styles.page}>
      <div style={styles.appFrame}>
        <VICHeader
          currentPath="/askvic"
          statusLabel={loading ? 'Thinking' : 'Ready'}
          statusTone={loading ? 'thinking' : 'ready'}
        />

        <div style={styles.shell}>
          {!isCompact ? (
            <div style={styles.leftColumn}>
              {heroSection}
              {toolsSection}
            </div>
          ) : null}

          <div style={styles.rightColumn}>
            {isCompact ? heroSection : null}

            <section style={styles.chatCard}>
              <div style={styles.chatHeader}>
                <div style={styles.chatHeaderContent}>
                  <div style={styles.chatMetaRow}>
                    <div style={styles.chatTitle}>Conversation</div>
                    <div style={styles.modeStatusPill}>{entryModeMeta.label}</div>
                  </div>
                  <div style={styles.chatStatusMessage}>
                    {lessonStatusText} {'•'} {entryModeMeta.helper}
                  </div>
                  <div style={styles.sessionModeToggle}>
                    <button
                      type="button"
                      onClick={() => handleSessionModeToggle('teacher_directed')}
                      disabled={teacherLessonDisabled}
                      style={
                        sessionMode === 'teacher_directed'
                          ? styles.sessionModeButtonActive
                          : teacherLessonDisabled
                            ? styles.sessionModeButtonDisabled
                            : styles.sessionModeButton
                      }
                      title={
                        teacherLessonDisabled
                          ? `Teacher Lesson disabled: ${teacherLessonDisabledReason}`
                          : 'Teacher Lesson available'
                      }
                    >
                      Teacher Lesson
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSessionModeToggle('student_directed')}
                      style={
                        sessionMode === 'student_directed'
                          ? styles.sessionModeButtonActive
                          : styles.sessionModeButton
                      }
                    >
                      My Own Work
                    </button>
                  </div>
                </div>

              </div>

              <div style={styles.chatCanvas}>
                <div ref={messageAreaRef} style={styles.messageArea}>
                  {messages.map((msg, index) => (
                    <div
                      key={index}
                      ref={(el) => {
                        messageRefs.current[index] = el
                      }}
                      style={msg.role === 'assistant' ? styles.assistantBubble : styles.userBubble}
                    >
                      <div
                        style={
                          msg.role === 'assistant'
                            ? styles.bubbleLabel
                            : styles.bubbleLabelUser
                        }
                      >
                        {msg.role === 'assistant' ? 'VIC' : 'You'}
                      </div>

                      <p
                        style={
                          msg.role === 'assistant'
                            ? styles.bubbleText
                            : styles.userBubbleText
                        }
                      >
                        {msg.text}
                      </p>

                      {msg.role === 'assistant' && msg.visual ? (
                        <VisualCardRenderer visual={msg.visual} styles={styles} />
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section style={styles.inputCard}>
              <div style={styles.inputHeaderRow}>
                <div style={styles.inputTitle}>Start here: choose a quick start or type your own</div>

                {!isMobile ? (
                  <div style={styles.inputHint}>Enter = send • Shift + Enter = new line</div>
                ) : null}
              </div>

              <div style={styles.guidedEntryRow}>
                {GUIDED_ENTRY_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    style={
                      pendingEntryIntent === option.id
                        ? styles.guidedEntryButtonActive
                        : styles.guidedEntryButton
                    }
                    onClick={() => handleGuidedEntry(option)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={isMobile ? 3 : 3}
                placeholder={
                  sessionMode === 'teacher_directed' && assignedLesson
                    ? 'Send your opening line to begin this lesson...'
                    : 'Ask a question or pick a quick start above...'
                }
                style={styles.mainTextarea}
              />

              <div style={styles.inputFooter}>
                <button
                  onClick={() => sendMessage()}
                  disabled={loading || !input.trim()}
                  style={{
                    ...styles.sendButton,
                    opacity: loading || !input.trim() ? 0.6 : 1,
                    cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Thinking...' : 'Send'}
                </button>
              </div>
            </section>

                        {isCompact ? toolsSection : null}

            {sketchExpanded ? (
              <div style={styles.sketchOverlay}>
                <div style={styles.sketchOverlayTopBar}>
                  <div style={styles.sketchOverlayTitle}>Large Sketch Pad</div>

                                    <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      style={styles.sketchSendButton}
                      onClick={discussSketch}
                    >
                      Send to VIC
                    </button>

                    <button
                      type="button"
                      style={styles.sketchOverlayCloseButton}
                      onClick={() => setSketchMinimized(!sketchMinimized)}
                    >
                      {sketchMinimized ? 'Expand' : 'Shrink'}
                    </button>

                    <button
                      type="button"
                      style={styles.sketchOverlayCloseButton}
                      onClick={() => setSketchExpanded(false)}
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div style={styles.sketchOverlayCanvasWrap}>
                  <canvas
                    ref={canvasRef}
                    style={styles.sketchCanvas}
                    onPointerDown={startCanvasStroke}
                    onPointerMove={moveCanvasStroke}
                    onPointerUp={stopCanvasStroke}
                    onPointerLeave={stopCanvasStroke}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <button
        type="button"
        style={styles.debugToggleButton}
        onClick={() => setIsDebugPanelOpen((prev) => !prev)}
      >
        {isDebugPanelOpen ? 'Hide Debug' : 'Debug'}
      </button>

      {isDebugPanelOpen ? (
        <aside style={styles.tempDebugPanelFloating}>
          <div style={styles.tempDebugTitle}>TEMP DEBUG — Teacher Lesson Resolution</div>
          <div style={styles.tempDebugSection}>1) Auth/session info</div>
          <div style={styles.tempDebugRow}>auth user id: {debugValue(debugAuthUserId)}</div>
          <div style={styles.tempDebugRow}>auth email: {debugValue(debugAuthEmail)}</div>

          <div style={styles.tempDebugSection}>2) Resolved app user info</div>
          <div style={styles.tempDebugRow}>
            resolved public.users id: {debugValue(debugResolvedUserId)}
          </div>
          <div style={styles.tempDebugRow}>resolved role: {debugValue(debugResolvedRole)}</div>
          <div style={styles.tempDebugRow}>
            selectedStudentId: {debugValue(selectedStudentId)}
          </div>

          <div style={styles.tempDebugSection}>3) Teacher lesson resolution</div>
          <div style={styles.tempDebugRow}>
            latest assignment found: {debugLatestAssignment.found ? 'yes' : 'no'}
          </div>
          <div style={styles.tempDebugRow}>
            latest assignment id: {debugValue(debugLatestAssignment.id)}
          </div>
          <div style={styles.tempDebugRow}>
            latest lesson id: {debugValue(debugLatestAssignment.lessonId)}
          </div>
          <div style={styles.tempDebugRow}>
            latest lesson title: {debugValue(debugLatestAssignment.lessonTitle)}
          </div>
          <div style={styles.tempDebugRow}>
            latest-assignment API status: {debugValue(debugLatestAssignmentApi.status)}
          </div>
          <div style={styles.tempDebugRow}>
            latest-assignment API ok: {debugValue(debugLatestAssignmentApi.ok)}
          </div>
          <div style={styles.tempDebugRow}>
            latest-assignment API response JSON:{' '}
            {debugJsonValue(debugLatestAssignmentApi.responseJson)}
          </div>
          <div style={styles.tempDebugRow}>
            latest-assignment API error: {debugValue(debugLatestAssignmentApi.error)}
          </div>
          <div style={styles.tempDebugRow}>
            hasTeacherAssignment: {hasTeacherAssignment ? 'true' : 'false'}
          </div>
          <div style={styles.tempDebugRow}>
            assignedLesson present: {assignedLesson ? 'true' : 'false'}
          </div>

          <div style={styles.tempDebugSection}>4) Mode state</div>
          <div style={styles.tempDebugRow}>current sessionMode: {debugValue(sessionMode)}</div>
          <div style={styles.tempDebugRow}>
            Teacher Lesson disabled: {teacherLessonDisabled ? 'true' : 'false'}
          </div>
          <div style={styles.tempDebugRow}>
            disabled reason: {debugValue(teacherLessonDisabledReason)}
          </div>
        </aside>
      ) : null}
    </div>
  )
}

function VisualCardRenderer({ visual, styles }) {
  if (!visual || !visual.type) return null

  if (visual.type === 'idle') {
    return (
      <div style={styles.visualIdleCard}>
        <div style={styles.visualIdleGlow} />
        <div style={styles.visualIdleInner}>
          <VICLogo size={62} variant="card" alt="VIC logo" />
          <div style={styles.visualIdleTextWrap}>
            <div style={styles.visualIdleTitle}>Visual support will appear here</div>
            <div style={styles.visualIdleText}>
              Diagrams, models, and step visuals show up only when they help.
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (visual.type === 'fraction') {
    const numerator = Math.max(0, Number(visual.numerator) || 0)
    const denominator = Math.max(1, Number(visual.denominator) || 1)

    return (
      <div style={styles.visualCard}>
        <div style={styles.visualHeaderRow}>
          <div style={styles.visualTitle}>{visual.title || 'Fraction model'}</div>
          <div style={styles.visualBadge}>
            {numerator}/{denominator}
          </div>
        </div>

        <div style={styles.fractionBarWrap}>
          {Array.from({ length: denominator }).map((_, index) => (
            <div
              key={index}
              style={{
                ...styles.fractionPiece,
                background:
                  index < numerator
                    ? 'linear-gradient(135deg, rgba(181,83,47,1) 0%, rgba(245,158,11,1) 100%)'
                    : 'var(--vic-border)',
              }}
            />
          ))}
        </div>

        <div style={styles.visualDescription}>
          {numerator} out of {denominator} equal parts are shaded.
        </div>
      </div>
    )
  }

  if (visual.type === 'numberline') {
    const start = Number.isFinite(visual.start) ? visual.start : 0
    const end = Number.isFinite(visual.end) ? visual.end : 10
    const highlight = Number.isFinite(visual.highlight) ? visual.highlight : start
    const values = []

    for (let i = start; i <= end; i += 1) {
      values.push(i)
    }

    return (
      <div style={styles.visualCard}>
        <div style={styles.visualHeaderRow}>
          <div style={styles.visualTitle}>{visual.title || 'Number line'}</div>
          <div style={styles.visualBadge}>Math visual</div>
        </div>

        <div style={styles.numberLineWrap}>
          <div style={styles.numberLineBase} />
          <div style={styles.numberLineRow}>
            {values.map((value) => {
              const isHighlight = value === highlight

              return (
                <div key={value} style={styles.numberTickWrap}>
                  <div
                    style={{
                      ...styles.numberDot,
                      background: isHighlight ? 'var(--vic-primary)' : 'var(--vic-disabled)',
                      boxShadow: isHighlight ? '0 0 0 5px rgba(181,83,47,0.18)' : 'none',
                    }}
                  />
                  <div
                    style={{
                      ...styles.numberLabel,
                      color: isHighlight ? 'var(--vic-primary)' : 'var(--vic-text-secondary)',
                      fontWeight: isHighlight ? 700 : 600,
                    }}
                  >
                    {value}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={styles.visualDescription}>The highlighted point shows {highlight}.</div>
      </div>
    )
  }

  if (visual.type === 'vocab') {
    return (
      <div style={styles.visualCard}>
        <div style={styles.visualHeaderRow}>
          <div style={styles.visualTitle}>{visual.title || 'Vocabulary card'}</div>
          <div style={styles.visualBadge}>ELA support</div>
        </div>

        <div style={styles.vocabWord}>{visual.word || 'Vocabulary'}</div>
        <div style={styles.vocabDefinition}>{visual.definition || ''}</div>

        {visual.example ? (
          <div style={styles.vocabExampleBox}>
            <div style={styles.vocabExampleLabel}>Example</div>
            <div style={styles.vocabExampleText}>{visual.example}</div>
          </div>
        ) : null}
      </div>
    )
  }

  if (visual.type === 'tip') {
    return (
      <div style={styles.visualCard}>
        <div style={styles.visualHeaderRow}>
          <div style={styles.visualTitle}>{visual.title || 'Quick tip'}</div>
          <div style={styles.visualBadge}>Support</div>
        </div>
        <div style={styles.visualDescription}>{visual.body || ''}</div>
      </div>
    )
  }

  return null
}

function inferVisualFromConversation(userText, assistantText) {
  const combined = `${userText} ${assistantText}`.toLowerCase()

  const fractionMatch =
    combined.match(/(\d+)\s*\/\s*(\d+)/) ||
    combined.match(/(\d+)\s+out of\s+(\d+)/)

  if (
    fractionMatch &&
    !combined.includes('grade 10') &&
    !combined.includes('chapter') &&
    !combined.includes('page')
  ) {
    const numerator = Number(fractionMatch[1])
    const denominator = Number(fractionMatch[2])

    if (denominator > 0 && denominator <= 12 && numerator <= denominator) {
      return {
        type: 'fraction',
        title: 'Fraction model',
        numerator,
        denominator,
      }
    }
  }

  const numberMatch =
    combined.match(/\bnumber line\b/) ||
    combined.match(/\bcount\b/) ||
    combined.match(/\binteger\b/) ||
    combined.match(/\bnegative\b/)

  if (numberMatch) {
    const highlightMatch = assistantText.match(/-?\d+/)
    const highlight = highlightMatch ? Number(highlightMatch[0]) : 3
    const start = Math.min(highlight - 3, 0)
    const end = Math.max(highlight + 3, 6)

    return {
      type: 'numberline',
      title: 'Number line',
      start,
      end,
      highlight,
    }
  }

  if (
    combined.includes('vocabulary') ||
    combined.includes('define') ||
    combined.includes('definition') ||
    combined.includes('meaning of')
  ) {
    const vocab = extractVocabularyCard(assistantText)
    if (vocab) return vocab
  }

  return {
    type: 'idle',
    title: 'Visual Support',
  }
}

function extractVocabularyCard(text) {
  if (!text) return null

  const pattern = /([A-Za-z][A-Za-z\s-]{1,30})\s+(means|is)\s+([^.!?]{8,180})/i
  const match = text.match(pattern)

  if (!match) return null

  const word = match[1].trim()
  const definition = match[3].trim()

  return {
    type: 'vocab',
    title: 'Vocabulary',
    word,
    definition,
    example: 'Try using the word in your own sentence.',
  }
}

function buildStyles({ isMobile, isTablet, isCompact, sketchExpanded, sketchMinimized }) {
  const desktopFixedHeight = !isCompact

  return {
    page: {
      height: desktopFixedHeight ? '100vh' : 'auto',
      minHeight: '100vh',
      background: 'var(--vic-bg)',
      color: 'var(--vic-text-primary)',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Helvetica, Arial, sans-serif',
      position: 'relative',
      overflowX: 'hidden',
      overflowY: desktopFixedHeight ? 'hidden' : 'visible',
    },

    backgroundGlowOne: {
      display: 'none',
      position: 'absolute',
      top: '-120px',
      left: '-90px',
      width: '320px',
      height: '320px',
      background: 'rgba(181, 83, 47, 0.12)',
      filter: 'blur(90px)',
      borderRadius: '50%',
      pointerEvents: 'none',
    },

    backgroundGlowTwo: {
      display: 'none',
      position: 'absolute',
      bottom: '-120px',
      right: '-70px',
      width: '340px',
      height: '340px',
      background: 'rgba(181, 83, 47, 0.09)',
      filter: 'blur(92px)',
      borderRadius: '50%',
      pointerEvents: 'none',
    },

    backgroundGlowThree: {
      display: 'none',
      position: 'absolute',
      top: '26%',
      right: '16%',
      width: '240px',
      height: '240px',
      background: 'rgba(150, 69, 40, 0.08)',
      filter: 'blur(82px)',
      borderRadius: '50%',
      pointerEvents: 'none',
    },

    backgroundGlowFour: {
      display: 'none',
      position: 'absolute',
      bottom: '12%',
      left: '8%',
      width: '220px',
      height: '220px',
      background: 'rgba(181, 83, 47, 0.08)',
      filter: 'blur(75px)',
      borderRadius: '50%',
      pointerEvents: 'none',
    },

    backgroundMesh: {
      display: 'none',
      position: 'absolute',
      inset: 0,
      background:
        'linear-gradient(rgba(255,255,255,0.016) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.016) 1px, transparent 1px)',
      backgroundSize: '32px 32px',
      maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.78), rgba(0,0,0,0.25))',
      pointerEvents: 'none',
    },

    backgroundSweep: {
      display: 'none',
      position: 'absolute',
      inset: 0,
      background:
        'linear-gradient(115deg, transparent 0%, transparent 36%, rgba(181, 83, 47, 0.08) 50%, transparent 64%, transparent 100%)',
      pointerEvents: 'none',
    },

    appFrame: {
      maxWidth: '1460px',
      height: desktopFixedHeight ? '100vh' : 'auto',
      margin: '0 auto',
      padding: isMobile ? '12px' : '16px',
      boxSizing: 'border-box',
      position: 'relative',
      zIndex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: isMobile ? '10px' : '12px',
    },

    topNav: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      flexShrink: 0,
      flexWrap: 'wrap',
      padding: isMobile ? '12px 14px' : '14px 18px',
      borderRadius: '22px',
      background: 'var(--vic-surface)',
      border: '1px solid var(--vic-border)',
      boxShadow:
        'var(--vic-shadow-card)',
      backdropFilter: 'blur(14px)',
    },

    topNavLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: isMobile ? '12px' : '18px',
      flexWrap: 'wrap',
      minWidth: 0,
      flex: 1,
    },

    topNavRight: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      flexShrink: 0,
      marginLeft: 'auto',
    },

    headerBadge: {
      fontSize: '11px',
      fontWeight: 800,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--vic-text-primary)',
      padding: '8px 12px',
      borderRadius: '999px',
      background: 'linear-gradient(135deg, rgba(181, 83, 47,0.22), rgba(123, 129, 99,0.12))',
      border: '1px solid #D8B7A7',
      boxShadow: '0 0 16px rgba(181, 83, 47,0.12)',
      whiteSpace: 'nowrap',
    },

    brandLink: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      textDecoration: 'none',
      color: 'var(--vic-text-primary)',
      minWidth: 0,
      flexShrink: 0,
    },

    brandLogoWrap: {
      width: isMobile ? '42px' : '46px',
      height: isMobile ? '42px' : '46px',
      borderRadius: '14px',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(239,231,220,0.96) 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      boxShadow:
        'inset 0 1px 0 rgba(255,255,255,0.78), 0 8px 18px rgba(0,0,0,0.18), 0 0 18px rgba(181, 83, 47, 0.10)',
      flexShrink: 0,
    },

    brandLogoImage: {
      width: '100%',
      height: '100%',
      objectFit: 'contain',
      transform: 'scale(1.18)',
      background: 'var(--vic-surface)',
    },

    brandTextWrap: {
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
    },

    brandTitle: {
      fontSize: isMobile ? '18px' : '20px',
      fontWeight: 800,
      lineHeight: 1.05,
      color: 'var(--vic-text-primary)',
    },

    brandSub: {
      fontSize: '12px',
      color: 'var(--vic-text-secondary)',
      lineHeight: 1.25,
    },

    navLinks: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      flexWrap: 'wrap',
      minWidth: 0,
    },

    navLink: {
      textDecoration: 'none',
      color: 'var(--vic-text-secondary)',
      fontSize: isMobile ? '13px' : '14px',
      fontWeight: 800,
      padding: isMobile ? '9px 12px' : '10px 14px',
      borderRadius: '12px',
      background: 'rgba(239, 231, 220, 0.85)',
      border: '1px solid rgba(232, 216, 200, 0.72)',
      boxShadow: 'inset 0 1px 0 rgba(239, 231, 220, 0.82)',
      whiteSpace: 'nowrap',
    },

    navLinkPrimary: {
      textDecoration: 'none',
      color: 'var(--vic-text-primary)',
      fontSize: isMobile ? '13px' : '14px',
      fontWeight: 800,
      padding: isMobile ? '9px 12px' : '10px 14px',
      borderRadius: '12px',
      background: 'linear-gradient(135deg, rgba(181, 83, 47,0.24), rgba(123, 129, 99,0.10))',
      border: '1px solid #D8B7A7',
      boxShadow: '0 0 18px rgba(181, 83, 47,0.10), inset 0 1px 0 rgba(239, 231, 220, 0.9)',
      whiteSpace: 'nowrap',
    },

    navLinkCurrent: {
      textDecoration: 'none',
      color: 'var(--vic-text-primary)',
      fontSize: isMobile ? '13px' : '14px',
      fontWeight: 800,
      padding: isMobile ? '9px 12px' : '10px 14px',
      borderRadius: '12px',
      background: 'var(--vic-surface)',
      border: '1px solid var(--vic-border-soft)',
      boxShadow: 'inset 0 1px 0 rgba(232, 216, 200, 0.72)',
      whiteSpace: 'nowrap',
    },

    shell: {
      flex: 1,
      minHeight: 0,
      overflow: 'visible',
      display: 'grid',
      gridTemplateColumns: isCompact ? '1fr' : '300px minmax(0, 1fr)',
      gap: isMobile ? '12px' : '16px',
      overflow: desktopFixedHeight ? 'hidden' : 'visible',
    },

    leftColumn: {
      minHeight: 0,
      display: 'grid',
      gridTemplateRows: 'auto minmax(0, 1fr)',
      gap: '12px',
      overflow: 'hidden',
    },

    rightColumn: {
      minHeight: 0,
      display: 'grid',
      gridTemplateRows: isCompact ? 'auto minmax(580px, 1fr) auto auto' : 'minmax(0, 1fr) auto',
      gap: isMobile ? '8px' : '8px',
      overflow: 'hidden',
    },

    heroCard: {
      background: 'var(--vic-surface)',
      border: '1px solid var(--vic-border-soft)',
      borderRadius: isMobile ? '16px' : '18px',
      padding: isMobile ? '14px' : '16px',
      boxShadow: 'var(--vic-shadow-card)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      overflow: 'hidden',
      position: 'relative',
      flexShrink: 0,
    },

    heroSparkle: {
      position: 'absolute',
      top: '-26px',
      right: '-14px',
      width: '170px',
      height: '170px',
      background: 'radial-gradient(circle, rgba(181, 83, 47, 0.10) 0%, rgba(181, 83, 47, 0) 72%)',
      pointerEvents: 'none',
    },

    heroTop: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '96px 1fr',
      gap: isMobile ? '12px' : '14px',
      alignItems: isMobile ? 'start' : 'center',
    },

    heroTextWrap: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      minWidth: 0,
    },

    versionPill: {
      alignSelf: 'flex-start',
      fontSize: '11px',
      fontWeight: 800,
      color: 'var(--vic-text-primary)',
      background: '#E8D8C8',
      border: '1px solid #D8B7A7',
      borderRadius: '999px',
      padding: '6px 10px',
      boxShadow: '0 0 16px rgba(181, 83, 47,0.12)',
    },

    heading: {
      margin: 0,
      fontSize: isMobile ? '28px' : isTablet ? '30px' : '32px',
      lineHeight: 1.08,
      letterSpacing: '-0.03em',
      fontWeight: 900,
      color: 'var(--vic-text-primary)',
      textShadow: 'none',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },

    tagline: {
      margin: 0,
      fontSize: isMobile ? '14px' : '15px',
      lineHeight: 1.45,
      color: 'var(--vic-text-primary)',
      maxWidth: '420px',
    },

    quickStartWrap: {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    },

    quickStartText: {
      fontSize: '13px',
      lineHeight: 1.45,
      color: 'var(--vic-text-secondary)',
      maxWidth: '560px',
    },

    sectionEyebrow: {
      fontSize: '11px',
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color: 'var(--vic-primary)',
      fontWeight: 800,
      marginBottom: '0px',
    },

    sectionTitle: {
      fontSize: isMobile ? '19px' : '22px',
      fontWeight: 800,
      color: 'var(--vic-text-primary)',
      marginTop: '0',
      lineHeight: 1.1,
    },

    subjectGrid: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
      gap: '10px',
    },

    subjectButton: {
      position: 'relative',
      border: '1px solid rgba(217, 203, 190, 0.40)',
      background:
        'linear-gradient(180deg, var(--vic-surface) 0%, var(--vic-surface-muted) 100%)',
      color: 'var(--vic-text-primary)',
      padding: isMobile ? '13px' : '14px',
      borderRadius: '18px',
      fontSize: '15px',
      fontWeight: 800,
      textAlign: 'left',
      boxShadow:
        '0 10px 22px rgba(0,0,0,0.18), 0 0 16px rgba(181, 83, 47,0.08), inset 0 1px 0 rgba(239, 231, 220, 0.82)',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      minHeight: isMobile ? '82px' : '88px',
      overflow: 'hidden',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      cursor: 'pointer',
    },

    subjectButtonGlow: {
      position: 'absolute',
      inset: '-35%',
      background: 'radial-gradient(circle at 18% 18%, rgba(181, 83, 47,0.18), transparent 38%)',
      pointerEvents: 'none',
    },

    subjectButtonLabel: {
      fontSize: isMobile ? '15px' : '16px',
      fontWeight: 800,
      position: 'relative',
      zIndex: 1,
    },

    subjectButtonSub: {
      fontSize: '11px',
      lineHeight: 1.3,
      color: 'var(--vic-text-secondary)',
      fontWeight: 600,
      position: 'relative',
      zIndex: 1,
    },

    quickStartInline: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: '10px',
      padding: '0 4px 4px 4px',
    },

    quickStartInlineLabel: {
      fontSize: '12px',
      fontWeight: 800,
      color: 'var(--vic-text-secondary)',
      whiteSpace: 'nowrap',
    },

    quickStartInlineButtons: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
    },

    quickStartPill: {
      background: 'rgba(232, 216, 200, 0.72)',
      border: '1px solid rgba(255,255,255,0.26)',
      color: 'var(--vic-text-primary)',
      padding: '8px 12px',
      borderRadius: '999px',
      fontSize: '13px',
      fontWeight: 800,
      cursor: 'pointer',
      boxShadow: 'inset 0 1px 0 rgba(239, 231, 220, 0.85)',
    },

    toolsCard: {
      minHeight: 0,
      background: 'var(--vic-surface)',
      border: '1px solid var(--vic-border-soft)',
      borderRadius: isMobile ? '14px' : '16px',
      padding: isMobile ? '12px' : '12px',
      boxShadow: 'var(--vic-shadow-card)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      overflowY: 'auto',
      flex: 1,
    },

    toolsHeaderRow: {
      display: 'grid',
      gridTemplateColumns: '1fr',
      alignItems: 'start',
      gap: '12px',
    },

    toolsHeaderText: {
      minWidth: 0,
    },

    toolsSubtext: {
      fontSize: '12px',
      color: 'var(--vic-text-secondary)',
      lineHeight: 1.3,
      marginTop: '4px',
    },

    toolTabsStickyWrap: {
      position: 'sticky',
      top: 0,
      zIndex: 6,
      background: 'var(--vic-surface)',
      paddingTop: '2px',
      paddingBottom: '2px',
    },

    toolTabsWrap: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, minmax(0, 1fr))',
      gap: '8px',
    },

    toolTab: {
      background: 'var(--vic-surface)',
      border: '1px solid var(--vic-border)',
      color: 'var(--vic-text-primary)',
      padding: '11px 10px',
      borderRadius: '9px',
      fontSize: isMobile ? '14px' : '13px',
      lineHeight: 1.2,
      fontWeight: 800,
      cursor: 'pointer',
      minHeight: '40px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      whiteSpace: 'nowrap',
    },

    toolTabActive: {
      background: 'var(--vic-primary)',
      border: '1px solid var(--vic-primary)',
      color: 'var(--vic-surface)',
      padding: '11px 10px',
      borderRadius: '9px',
      fontSize: isMobile ? '14px' : '13px',
      lineHeight: 1.2,
      fontWeight: 800,
      boxShadow: '0 12px 26px rgba(181, 83, 47, 0.35)',
      cursor: 'pointer',
      minHeight: '40px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      whiteSpace: 'nowrap',
    },

    workspacePanel: {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      flexShrink: 0,
      minHeight: 0,
    },

    supportRowTwoUp: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
      gap: '10px',
      flexShrink: 0,
      position: 'relative',
    },

    supportRow: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
      gap: '10px',
    },

    supportButton: {
      background: 'linear-gradient(135deg, rgba(239, 231, 220, 0.9), rgba(181, 83, 47,0.05))',
      border: '1px solid rgba(217, 203, 190, 0.45)',
      color: 'var(--vic-text-primary)',
      padding: '11px 12px',
      borderRadius: '14px',
      fontSize: '13px',
      fontWeight: 800,
      cursor: 'pointer',
    },

    supportButtonActive: {
      background:
        'linear-gradient(135deg, rgba(181, 83, 47,0.24) 0%, rgba(123, 129, 99,0.10) 100%)',
      border: '1px solid rgba(150, 69, 40, 0.28)',
      color: 'var(--vic-text-primary)',
      padding: '11px 12px',
      borderRadius: '14px',
      fontSize: '13px',
      fontWeight: 800,
      boxShadow: '0 12px 26px rgba(181, 83, 47, 0.35)',
      cursor: 'pointer',
    },

    sketchToolbar: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      flexShrink: 0,
    },

    sketchCanvasWrap: {
      width: '100%',
      minHeight: isMobile ? '340px' : sketchExpanded ? '78vh' : '560px',
      height: isMobile ? '340px' : sketchExpanded ? '78vh' : '560px',
      maxHeight: isMobile ? '340px' : '900px',
      borderRadius: '18px',
      border: '1px solid var(--vic-border)',
      background: SKETCH_BG_COLOR,
      overflow: 'hidden',
      boxSizing: 'border-box',
      flexShrink: 0,
      position: 'relative',
      zIndex: 1,
    },
    supportButtonWhite: {
      background: 'var(--vic-surface)',
      border: '1px solid var(--vic-border)',
      color: 'var(--vic-text-primary)',
      padding: '13px 18px',
      borderRadius: '10px',
      fontSize: '13px',
      fontWeight: 800,
      cursor: 'pointer',
    },

    supportButtonWhiteStrong: {
      background: 'var(--vic-primary)',
      border: '1px solid var(--vic-primary)',
      color: 'var(--vic-surface)',
      padding: '14px 20px',
      borderRadius: '10px',
      fontSize: '13px',
      fontWeight: 800,
      cursor: 'pointer',
      boxShadow: '0 12px 28px rgba(181, 83, 47, 0.35)',
    },

    sketchToolButton: {
      border: '1px solid var(--vic-border)',
      background: 'var(--vic-surface)',
      color: 'var(--vic-text-primary)',
      padding: '10px 15px',
      borderRadius: '12px',
      fontSize: '13px',
      fontWeight: 800,
      cursor: 'pointer',
    },
       sketchCornerExpandButton: {
      position: 'absolute',
      right: '12px',
      bottom: '12px',
      zIndex: 3,
      width: '38px',
      height: '38px',
      border: '1px solid rgba(231, 220, 207, 0.95)',
      background: 'var(--vic-surface)',
      color: 'var(--vic-text-primary)',
      borderRadius: '10px',
      fontSize: '20px',
      fontWeight: 800,
      cursor: 'pointer',
      boxShadow: '0 8px 20px rgba(0,0,0,0.14)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      lineHeight: 1,
    },
         sketchOverlay: {
      position: 'fixed',
      top: '110px',
      left: '24px',
      right: 'auto',
           width: isMobile ? 'calc(100vw - 24px)' : sketchMinimized ? '260px' : '50vw',
      height: isMobile ? '72vh' : sketchMinimized ? '140px' : '74vh',
      maxWidth: '920px',
      minWidth: isMobile ? '0' : '620px',
      zIndex: 9999,
      background: 'var(--vic-surface)',
      border: '1px solid var(--vic-border)',
      borderRadius: '22px',
      boxShadow: '0 24px 60px rgba(0,0,0,0.40)',
      backdropFilter: 'blur(16px)',
      padding: '14px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      overflow: 'hidden',
    },
    sketchOverlayTopBar: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      flexShrink: 0,
    },

    sketchOverlayTitle: {
      fontSize: '16px',
      fontWeight: 800,
      color: 'var(--vic-text-primary)',
    },

    sketchOverlayCloseButton: {
      border: '1px solid rgba(231, 220, 207, 0.95)',
      background: 'var(--vic-surface)',
      color: 'var(--vic-text-primary)',
      padding: '8px 12px',
      borderRadius: '10px',
      fontSize: '13px',
      fontWeight: 800,
      cursor: 'pointer',
      boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
    },

    sketchSendButton: {
      border: '1px solid rgba(181, 83, 47, 0.35)',
      background: 'linear-gradient(135deg, var(--vic-primary) 0%, var(--vic-primary-hover) 100%)',
      color: 'var(--vic-surface)',
      padding: '8px 12px',
      borderRadius: '10px',
      fontSize: '13px',
      fontWeight: 800,
      cursor: 'pointer',
      boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
    },

    sketchOverlayCanvasWrap: {
      flex: 1,
      minHeight: 0,
      borderRadius: '18px',
      border: '1px solid var(--vic-border)',
      background: SKETCH_BG_COLOR,
      overflow: 'hidden',
    },
    sketchCanvas: {
      width: '100%',
      height: '100%',
      display: 'block',
      background: SKETCH_BG_COLOR,
      touchAction: 'none',
      boxSizing: 'border-box',
    },

    toolStripCard: {
      borderRadius: '18px',
      padding: '14px',
      background:
        'linear-gradient(135deg, rgba(181, 83, 47,0.10), rgba(245, 158, 11,0.04))',
      border: '1px solid rgba(217, 203, 190, 0.45)',
      boxShadow: '0 0 18px rgba(181, 83, 47,0.06)',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    },

    toolStripHeader: {
      display: 'flex',
      alignItems: 'start',
      justifyContent: 'space-between',
      gap: '10px',
    },

    toolStripLabel: {
      fontSize: '11px',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: 'var(--vic-text-secondary)',
      fontWeight: 800,
      marginBottom: '4px',
    },

    toolStripTitle: {
      fontSize: '17px',
      lineHeight: 1.1,
      fontWeight: 800,
      color: 'var(--vic-text-primary)',
    },


    reportFeatureCardCompact: {
      borderRadius: '18px',
      padding: '14px',
      marginTop: '4px',
      background: 'var(--vic-surface)',
      border: '1px solid var(--vic-border-soft)',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      position: 'relative',
      zIndex: 2,
      overflow: 'hidden',
      flexShrink: 0,
    },

    reportFeatureTopCompact: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr auto',
      gap: '12px',
      alignItems: 'start',
    },

    reportFeatureLabelCompact: {
      fontSize: '11px',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: 'var(--vic-text-secondary)',
      fontWeight: 800,
      marginBottom: '4px',
    },

    reportFeatureTitleCompact: {
      fontSize: '16px',
      lineHeight: 1.1,
      fontWeight: 800,
      color: 'var(--vic-text-primary)',
    },

    reportFeatureTextCompact: {
      fontSize: '13px',
      lineHeight: 1.5,
      color: 'var(--vic-text-secondary)',
    },

    reportFeatureHintCompact: {
      fontSize: '12px',
      lineHeight: 1.4,
      color: 'var(--vic-text-secondary)',
      borderTop: '1px solid var(--vic-border-soft)',
      paddingTop: '8px',
    },

    reportDeliveryStatus: {
      fontSize: '12px',
      lineHeight: 1.45,
      color: 'var(--vic-text-secondary)',
      borderRadius: '12px',
      background: 'var(--vic-surface-muted)',
      border: '1px solid var(--vic-border-soft)',
      padding: '8px 10px',
    },

    reportPreviewInline: {
      paddingTop: '6px',
      borderTop: '1px solid rgba(239, 231, 220, 0.9)',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    },

    reportPreviewInlineLabel: {
      fontSize: '11px',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      fontWeight: 800,
      color: 'var(--vic-text-secondary)',
    },

    reportPreviewInlineText: {
      fontSize: '12px',
      lineHeight: 1.45,
      color: 'var(--vic-text-secondary)',
      display: '-webkit-box',
      WebkitLineClamp: 3,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
    },

    reportFeatureCard: {
      borderRadius: '20px',
      padding: '16px',
      background:
        'linear-gradient(135deg, rgba(181, 83, 47,0.16), rgba(123, 129, 99,0.06))',
      border: '1px solid rgba(217, 203, 190, 0.45)',
      boxShadow: '0 0 22px rgba(181, 83, 47,0.08)',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    },

    reportFeatureTop: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr auto',
      gap: '12px',
      alignItems: 'start',
    },

    reportFeatureLabel: {
      fontSize: '11px',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: 'var(--vic-text-secondary)',
      fontWeight: 800,
      marginBottom: '4px',
    },

    reportFeatureTitle: {
      fontSize: '20px',
      lineHeight: 1.05,
      fontWeight: 800,
      color: 'var(--vic-text-primary)',
    },

    reportFeatureText: {
      fontSize: '14px',
      lineHeight: 1.55,
      color: 'var(--vic-text-secondary)',
    },

    reportPreviewCard: {
      marginTop: '4px',
      padding: '12px 13px',
      borderRadius: '16px',
      background: 'rgba(232, 216, 200, 0.72)',
      border: '1px solid rgba(232, 216, 200, 0.72)',
    },

    reportPreviewLabel: {
      fontSize: '11px',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      fontWeight: 800,
      color: 'var(--vic-text-secondary)',
      marginBottom: '8px',
    },

    reportPreviewText: {
      fontSize: '13px',
      lineHeight: 1.5,
      color: 'var(--vic-text-primary)',
    },

    reportButton: {
      border: '1px solid var(--vic-primary)',
      background: 'var(--vic-primary)',
      color: 'var(--vic-surface)',
      padding: '10px 14px',
      borderRadius: '14px',
      fontSize: '14px',
      fontWeight: 800,
      whiteSpace: 'nowrap',
      boxShadow: '0 0 20px rgba(181, 83, 47,0.10)',
      alignSelf: 'start',
      cursor: 'pointer',
    },

    reportButtonDisabled: {
      border: '1px solid var(--vic-border-soft)',
      background: 'var(--vic-surface-muted)',
      color: 'var(--vic-disabled)',
      padding: '10px 14px',
      borderRadius: '14px',
      fontSize: '14px',
      fontWeight: 800,
      whiteSpace: 'nowrap',
      alignSelf: 'start',
    },

    toolToggleRow: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
      gap: '10px',
    },

    toolToggle: {
      background: 'linear-gradient(135deg, rgba(239, 231, 220, 0.9), rgba(181, 83, 47,0.05))',
      border: '1px solid rgba(217, 203, 190, 0.45)',
      color: 'var(--vic-text-primary)',
      padding: '12px 14px',
      borderRadius: '15px',
      fontSize: '14px',
      fontWeight: 800,
      cursor: 'pointer',
    },

    toolToggleActive: {
      background:
        'linear-gradient(135deg, rgba(181, 83, 47,0.24) 0%, rgba(123, 129, 99,0.10) 100%)',
      border: '1px solid rgba(150, 69, 40, 0.28)',
      color: 'var(--vic-text-primary)',
      padding: '12px 14px',
      borderRadius: '15px',
      fontSize: '14px',
      fontWeight: 800,
      boxShadow: '0 12px 26px rgba(181, 83, 47, 0.35)',
      cursor: 'pointer',
    },

    practiceWrap: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },

    practiceHeaderRow: {
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
    },

    practiceHint: {
      fontSize: '12px',
      color: 'var(--vic-text-secondary)',
      lineHeight: 1.4,
    },

    practiceHintDarkText: {
      fontSize: '12px',
      color: 'var(--vic-text-secondary)',
      lineHeight: 1.4,
    },

    miniLabel: {
      fontSize: '13px',
      fontWeight: 800,
      color: 'var(--vic-text-primary)',
    },

    miniLabelDarkText: {
      fontSize: '13px',
      fontWeight: 800,
      color: 'var(--vic-text-primary)',
    },

    miniLabelDark: {
      fontSize: '13px',
      fontWeight: 800,
      color: 'var(--vic-text-primary)',
      marginBottom: '8px',
    },

    sideTextarea: {
      width: '100%',
      minHeight: isMobile ? '160px' : '220px',
      resize: 'vertical',
      borderRadius: '16px',
      border: '1px solid var(--vic-border)',
      background: 'var(--vic-surface)',
      color: 'var(--vic-text-primary)',
      padding: '14px',
      boxSizing: 'border-box',
      outline: 'none',
      fontSize: '14px',
      lineHeight: 1.45,
    },

    toolPanel: {
      borderRadius: '18px',
      border: '1px solid rgba(217, 203, 190, 0.35)',
      background: 'rgba(239, 231, 220, 0.82)',
      padding: '14px',
    },

    toolPanelWhite: {
      borderRadius: '18px',
      border: '1px solid var(--vic-border-soft)',
      background: 'var(--vic-surface)',
      padding: '14px',
      boxShadow: '0 14px 30px rgba(15, 23, 42, 0.12)',
    },

    calcInput: {
      width: '100%',
      borderRadius: '14px',
      border: '1px solid rgba(231, 220, 207, 0.95)',
      background: 'var(--vic-surface)',
      color: 'var(--vic-text-primary)',
      padding: '12px 14px',
      boxSizing: 'border-box',
      outline: 'none',
      fontSize: '14px',
      marginBottom: '10px',
    },

    calcRow: {
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'auto 1fr',
      gap: '10px',
      alignItems: 'center',
    },

    smallButton: {
      border: '1px solid rgba(217, 203, 190, 0.5)',
      background: 'linear-gradient(135deg, rgba(181, 83, 47,0.18), rgba(123, 129, 99,0.08))',
      color: 'var(--vic-text-primary)',
      padding: '10px 14px',
      borderRadius: '12px',
      fontSize: '14px',
      fontWeight: 800,
      cursor: 'pointer',
    },

    calcResult: {
      minHeight: '20px',
      fontSize: '14px',
      color: 'var(--vic-text-secondary)',
      wordBreak: 'break-word',
    },

    smallButtonDark: {
      border: '1px solid var(--vic-primary)',
      background: 'linear-gradient(135deg, var(--vic-primary) 0%, var(--vic-primary-hover) 100%)',
      color: 'var(--vic-surface)',
      padding: '10px 14px',
      borderRadius: '12px',
      fontSize: '14px',
      fontWeight: 800,
      cursor: 'pointer',
    },

    calcResultDark: {
      minHeight: '20px',
      fontSize: '14px',
      color: 'var(--vic-text-secondary)',
      wordBreak: 'break-word',
    },


    notesTextareaLarge: {
      width: '100%',
      minHeight: isMobile ? '160px' : '220px',
      resize: 'vertical',
      borderRadius: '16px',
      border: '1px solid var(--vic-border)',
      background: 'var(--vic-surface)',
      color: 'var(--vic-text-primary)',
      padding: '14px',
      boxSizing: 'border-box',
      outline: 'none',
      fontSize: '14px',
      lineHeight: 1.45,
    },

    notesTextarea: {
      width: '100%',
      minHeight: '120px',
      resize: 'vertical',
      borderRadius: '14px',
      border: '1px solid rgba(217, 203, 190, 0.45)',
      background: 'var(--vic-surface)',
      color: 'var(--vic-text-primary)',
      padding: '12px 14px',
      boxSizing: 'border-box',
      outline: 'none',
      fontSize: '14px',
      lineHeight: 1.45,
    },

    chatCard: {
      minHeight: isCompact ? '74vh' : 0,
      background: 'var(--vic-surface)',
      border: '1px solid var(--vic-border-soft)',
      borderRadius: isMobile ? '16px' : '18px',
      padding: isMobile ? '8px' : '10px',
      boxShadow: 'var(--vic-shadow-card)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      minWidth: 0,
    },

    chatHeader: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: '10px',
      marginBottom: '4px',
      paddingBottom: '4px',
      borderBottom: '1px solid var(--vic-border-soft)',
      flexShrink: 0,
      flexWrap: 'wrap',
    },

    chatHeaderContent: {
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: '3px',
      width: '100%',
    },

    chatMetaRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '8px',
      flexWrap: 'wrap',
    },

    chatEyebrow: {
      fontSize: '11px',
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: 'var(--vic-primary)',
      fontWeight: 800,
      marginBottom: '4px',
    },

    chatTitle: {
      fontSize: isMobile ? '20px' : '22px',
      fontWeight: 900,
      color: 'var(--vic-text-primary)',
      lineHeight: 1.1,
    },

    chatStatusMessage: {
      fontSize: '12px',
      lineHeight: 1.35,
      color: 'var(--vic-text-secondary)',
      opacity: 0.92,
      maxWidth: '720px',
    },

    sessionModeToggle: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      width: 'fit-content',
      padding: '3px',
      borderRadius: '999px',
      border: '1px solid var(--vic-border-soft)',
      background: 'var(--vic-surface-muted)',
      marginTop: '3px',
    },

    sessionModeButton: {
      border: '1px solid transparent',
      background: 'transparent',
      color: 'var(--vic-text-secondary)',
      borderRadius: '999px',
      padding: '7px 14px',
      fontSize: '12px',
      lineHeight: 1.2,
      fontWeight: 700,
      cursor: 'pointer',
      minHeight: '34px',
      whiteSpace: 'nowrap',
    },

    sessionModeButtonActive: {
      border: '1px solid rgba(181, 83, 47, 0.34)',
      background: 'rgba(181, 83, 47, 0.14)',
      color: 'var(--vic-text-primary)',
      borderRadius: '999px',
      padding: '7px 14px',
      fontSize: '12px',
      lineHeight: 1.2,
      fontWeight: 800,
      cursor: 'pointer',
      minHeight: '34px',
      whiteSpace: 'nowrap',
    },

    sessionModeButtonDisabled: {
      border: '1px solid transparent',
      background: 'transparent',
      color: 'var(--vic-disabled)',
      borderRadius: '999px',
      padding: '7px 14px',
      fontSize: '12px',
      lineHeight: 1.2,
      fontWeight: 700,
      cursor: 'not-allowed',
      minHeight: '34px',
      whiteSpace: 'nowrap',
    },
    tempDebugPanelFloating: {
      position: 'fixed',
      right: isMobile ? '10px' : '16px',
      bottom: isMobile ? '58px' : '64px',
      width: isMobile ? 'calc(100vw - 20px)' : 'min(520px, calc(100vw - 32px))',
      maxHeight: isMobile ? '38vh' : '36vh',
      borderRadius: '8px',
      border: '1px dashed rgba(181, 83, 47, 0.45)',
      background: 'rgba(248, 250, 252, 0.97)',
      padding: '8px 10px',
      display: 'grid',
      gap: '3px',
      overflowY: 'auto',
      boxShadow: 'var(--vic-shadow-card)',
      zIndex: 35,
    },
    debugToggleButton: {
      position: 'fixed',
      right: isMobile ? '10px' : '16px',
      bottom: isMobile ? '10px' : '16px',
      border: '1px solid rgba(181, 83, 47, 0.34)',
      background: 'rgba(181, 83, 47, 0.14)',
      color: 'var(--vic-text-primary)',
      borderRadius: '999px',
      padding: '8px 12px',
      fontSize: '11px',
      lineHeight: 1.2,
      fontWeight: 800,
      cursor: 'pointer',
      zIndex: 36,
    },
    tempDebugTitle: {
      fontSize: '10px',
      fontWeight: 900,
      letterSpacing: '0.04em',
      color: 'var(--vic-text-primary)',
      textTransform: 'uppercase',
      marginBottom: '2px',
    },
    tempDebugSection: {
      marginTop: '4px',
      fontSize: '10px',
      fontWeight: 800,
      color: 'var(--vic-text-secondary)',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
    },
    tempDebugRow: {
      fontSize: '10px',
      lineHeight: 1.25,
      color: 'var(--vic-text-primary)',
      wordBreak: 'break-word',
    },

    modeStatusPill: {
      alignSelf: 'flex-start',
      marginTop: '0',
      fontSize: '10px',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--vic-primary)',
      fontWeight: 800,
      borderRadius: '999px',
      border: '1px solid rgba(181, 83, 47, 0.28)',
      background: 'rgba(181, 83, 47, 0.08)',
      padding: '3px 8px',
      width: 'fit-content',
    },

    chatCanvas: {
      flex: 1,
      minHeight: 0,
      display: 'flex',
      background: 'var(--vic-surface)',
      borderRadius: '10px',
      padding: isMobile ? '8px' : '8px',
      border: '1px solid var(--vic-border-soft)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95)',
      overflow: 'hidden',
    },

    messageArea: {
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      paddingRight: isMobile ? '2px' : '4px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },

    assistantBubble: {
      alignSelf: 'flex-start',
      maxWidth: isMobile ? '94%' : '82%',
      borderRadius: '14px 14px 14px 6px',
      background: 'var(--vic-surface-muted)',
      border: '1px solid #D8B7A7',
      padding: '12px 12px',
      boxShadow: '0 10px 22px rgba(15, 23, 42, 0.12)',
    },

    userBubble: {
      alignSelf: 'flex-end',
      maxWidth: isMobile ? '94%' : '78%',
      borderRadius: '14px 14px 6px 14px',
      background: 'var(--vic-surface)',
      border: '1px solid var(--vic-border-soft)',
      padding: '12px 12px',
      boxShadow: '0 10px 22px rgba(15, 23, 42, 0.1)',
    },

    bubbleLabel: {
      fontSize: '11px',
      fontWeight: 800,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: 'var(--vic-primary)',
      marginBottom: '6px',
    },

    bubbleLabelUser: {
      fontSize: '11px',
      fontWeight: 800,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: 'var(--vic-text-secondary)',
      marginBottom: '6px',
    },

    bubbleText: {
      margin: 0,
      whiteSpace: 'pre-wrap',
      fontSize: '16px',
      lineHeight: 1.65,
      color: 'var(--vic-text-primary)',
    },

    userBubbleText: {
      margin: 0,
      whiteSpace: 'pre-wrap',
      fontSize: '16px',
      lineHeight: 1.65,
      color: 'var(--vic-text-primary)',
    },

    inputCard: {
      background: 'var(--vic-surface)',
      border: '1px solid var(--vic-border-soft)',
      borderRadius: isMobile ? '16px' : '18px',
      padding: isMobile ? '8px' : '9px',
      boxShadow:
        '0 18px 42px rgba(15, 23, 42, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
      display: 'flex',
      flexDirection: 'column',
      gap: '5px',
      flexShrink: 0,
    },

    inputHeaderRow: {
      display: 'flex',
      alignItems: isMobile ? 'flex-start' : 'center',
      justifyContent: 'space-between',
      gap: '8px',
      flexWrap: 'wrap',
    },

    inputTitle: {
      fontSize: isMobile ? '14px' : '15px',
      fontWeight: 800,
      color: 'var(--vic-text-primary)',
      lineHeight: 1.2,
    },

    inputHint: {
      fontSize: '12px',
      color: 'var(--vic-text-secondary)',
      lineHeight: 1.4,
      textAlign: 'right',
    },

    guidedEntryRow: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '6px',
    },

    guidedEntryButton: {
      border: '1px solid var(--vic-border)',
      background: 'var(--vic-surface)',
      color: 'var(--vic-text-primary)',
      borderRadius: '999px',
      padding: '8px 14px',
      fontSize: '12px',
      fontWeight: 700,
      cursor: 'pointer',
    },

    guidedEntryButtonActive: {
      border: '1px solid var(--vic-primary)',
      background: 'rgba(181, 83, 47, 0.1)',
      color: 'var(--vic-text-primary)',
      borderRadius: '999px',
      padding: '8px 14px',
      fontSize: '12px',
      fontWeight: 800,
      cursor: 'pointer',
    },

    mainTextarea: {
      width: '100%',
      minHeight: isMobile ? '58px' : '58px',
      resize: 'vertical',
      borderRadius: '10px',
      border: '1px solid var(--vic-border)',
      background: 'var(--vic-surface)',
      color: 'var(--vic-text-primary)',
      padding: '9px 11px',
      boxSizing: 'border-box',
      outline: 'none',
      fontSize: '15px',
      lineHeight: 1.45,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
    },

    inputFooter: {
      display: 'flex',
      alignItems: isMobile ? 'stretch' : 'center',
      justifyContent: 'flex-end',
      gap: '8px',
      flexDirection: isMobile ? 'column' : 'row',
    },

    sendButton: {
      border: '1px solid var(--vic-primary)',
      background: 'var(--vic-primary)',
      color: 'var(--vic-surface)',
      padding: isMobile ? '11px 18px' : '12px 22px',
      borderRadius: '10px',
      fontSize: '16px',
      fontWeight: 900,
      minWidth: isMobile ? '100%' : '120px',
      boxShadow: '0 10px 22px rgba(181,83,47,0.28)',
    },

    visualIdleCard: {
      position: 'relative',
      marginTop: '12px',
      borderRadius: '18px',
      overflow: 'hidden',
      background: 'linear-gradient(180deg, rgba(232, 216, 200, 0.72), rgba(239, 231, 220, 0.82))',
      border: '1px solid rgba(232, 216, 200, 0.72)',
    },

    visualIdleGlow: {
      position: 'absolute',
      inset: 0,
      background: 'radial-gradient(circle at 20% 20%, rgba(181, 83, 47,0.18), transparent 40%)',
      pointerEvents: 'none',
    },

    visualIdleInner: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '14px',
    },

    visualIdleTextWrap: {
      minWidth: 0,
    },

    visualIdleTitle: {
      fontSize: '14px',
      fontWeight: 800,
      color: 'var(--vic-text-primary)',
      marginBottom: '4px',
    },

    visualIdleText: {
      fontSize: '13px',
      lineHeight: 1.45,
      color: 'var(--vic-text-secondary)',
    },

    visualCard: {
      marginTop: '12px',
      borderRadius: '18px',
      background: 'var(--vic-surface)',
      padding: '14px',
      color: 'var(--vic-text-primary)',
      boxShadow: '0 12px 28px rgba(181, 83, 47, 0.35)',
      overflow: 'hidden',
    },

    visualHeaderRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '10px',
      marginBottom: '12px',
      flexWrap: 'wrap',
    },

    visualTitle: {
      fontSize: '14px',
      fontWeight: 800,
      color: 'var(--vic-text-primary)',
    },

    visualBadge: {
      fontSize: '11px',
      fontWeight: 800,
      color: 'var(--vic-primary)',
      background: 'var(--vic-text-primary)',
      borderRadius: '999px',
      padding: '6px 10px',
    },

    visualDescription: {
      fontSize: '13px',
      lineHeight: 1.45,
      color: 'var(--vic-text-secondary)',
      marginTop: '10px',
    },

    fractionBarWrap: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(22px, 1fr))',
      gap: '6px',
    },

    fractionPiece: {
      height: '36px',
      borderRadius: '10px',
      border: '1px solid rgba(148,163,184,0.18)',
    },

    numberLineWrap: {
      position: 'relative',
      paddingTop: '14px',
      paddingBottom: '4px',
    },

    numberLineBase: {
      position: 'absolute',
      top: '21px',
      left: '0',
      right: '0',
      height: '2px',
      background: 'var(--vic-border)',
    },

    numberLineRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(32px, 1fr))',
      gap: '4px',
      position: 'relative',
      zIndex: 1,
    },

    numberTickWrap: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '8px',
    },

    numberDot: {
      width: '12px',
      height: '12px',
      borderRadius: '50%',
    },

    numberLabel: {
      fontSize: '12px',
      fontWeight: 600,
    },

    vocabWord: {
      fontSize: '22px',
      fontWeight: 800,
      color: 'var(--vic-text-primary)',
      marginBottom: '8px',
    },

    vocabDefinition: {
      fontSize: '14px',
      lineHeight: 1.5,
      color: 'var(--vic-text-secondary)',
    },

    vocabExampleBox: {
      marginTop: '12px',
      padding: '12px',
      borderRadius: '14px',
      background: 'var(--vic-bg)',
      border: '1px solid var(--vic-border)',
    },

    vocabExampleLabel: {
      fontSize: '11px',
      fontWeight: 800,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: '#6b7280',
      marginBottom: '6px',
    },

    vocabExampleText: {
      fontSize: '13px',
      lineHeight: 1.45,
      color: 'var(--vic-text-secondary)',
    },
  }
}

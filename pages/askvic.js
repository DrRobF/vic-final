import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import VICHeader from '../components/VICHeader'
import VICLogo from '../components/VICLogo'
import { lessonFromAssignment, pickLatestAssignment } from '../lib/assignment-resolution'
import { messagesForModeSwitch } from '../lib/ask-vic-context.mjs'

const SKETCH_BG_COLOR = '#f8fafc'
const SKETCH_INK_COLOR = '#0f172a'

const INITIAL_MESSAGES = [
  {
    role: 'assistant',
    text:
      'Let’s start learning 👇\n\nTry something like:\n• "Help me understand fractions"\n• "Give me a reading passage"\n\nType what you want help with, and VIC will help you get started.',
    visual: { type: 'idle', title: 'Visual Support' },
  },
]

const ASSIGNED_LESSON_READY_MESSAGE = (lessonTitle) => ({
  role: 'assistant',
  text: `Your teacher assigned "${lessonTitle || 'a lesson'}." Send any message when you're ready to begin.`,
  visual: { type: 'tip', title: 'Assigned lesson ready' },
})

const ASSIGNED_LESSON_UNAVAILABLE_MESSAGE = {
  role: 'assistant',
  text: 'Your teacher assigned a lesson, but the lesson details are unavailable right now.',
  visual: { type: 'tip', title: 'Assigned lesson unavailable' },
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
    helper: 'Type what you want help with, and VIC will help you get started.',
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

function
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      return { rows: [], latestAssignment: null, assignedLesson: null, error: new Error(payload?.error || 'Could not load assignment.') }
    }
    return {
      rows: Array.isArray(payload?.rows) ? payload.rows : [],
      latestAssignment: payload?.latestAssignment || null,
      assignedLesson: payload?.assignedLesson || null,
      error: null,
    }
  } catch (_error) {
    return { rows: [], latestAssignment: null, assignedLesson: null, error: new Error('Could not load assignment.') }
  }
}

export default function AskVIC() {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [workArea, setWorkArea] = useState('')
  const [notes, setNotes] = useState('')
  const [activeTool, setActiveTool] = useState(null)
  const [calcInput, setCalcInput] = useState('')
  const [calcResult, setCalcResult] = useState('')
  const [viewportWidth, setViewportWidth] = useState(1400)
  const [selectedStudentId, setSelectedStudentId] = useState(null)
  const [assignedLesson, setAssignedLesson] = useState(null)
  const [hasTeacherAssignment, setHasTeacherAssignment] = useState(false)
  const [studentMode, setStudentMode] = useState('')
  const [studentSupportLevel, setStudentSupportLevel] = useState('')
  const [studentInterest, setStudentInterest] = useState('')
  const [sessionInterestInput, setSessionInterestInput] = useState('')
  const [isEditingSessionInterest, setIsEditingSessionInterest] = useState(false)
  const [interestStatus, setInterestStatus] = useState({ tone: '', text: '' })
  const [interestSaving, setInterestSaving] = useState(false)
  const [joinClassCode, setJoinClassCode] = useState('')
  const [joinClassStatus, setJoinClassStatus] = useState({ tone: '', text: '' })
  const [joinClassLoading, setJoinClassLoading] = useState(false)
  const [enrolledClasses, setEnrolledClasses] = useState([])
  const [activeClassId, setActiveClassId] = useState(null)
  const [studentGradeLevel, setStudentGradeLevel] = useState('')
  const [studentLookupStatus, setStudentLookupStatus] = useState('Loading student...')
  const [sessionMode, setSessionMode] = useState('student_directed')
  const [messages, setMessages] = useState(INITIAL_MESSAGES)
  const [currentUserProfile, setCurrentUserProfile] = useState(null)
  const [currentUserStatus, setCurrentUserStatus] = useState('Loading signed-in user...')


  const resolvedAssignedLessonTitle = cleanLessonTitle(assignedLesson?.title)
  const hasAssignedLessonContent =
    typeof assignedLesson?.lesson_text === 'string' && assignedLesson.lesson_text.trim().length > 0
  const hasResolvedAssignedLessonTitle = Boolean(resolvedAssignedLessonTitle)

  const lessonStatusText = sessionMode === 'student_directed'
    ? 'My Own Work: choose what you want to learn.'
    : hasTeacherAssignment
      ? hasResolvedAssignedLessonTitle
        ? `Assigned lesson: ${resolvedAssignedLessonTitle}`
        : 'Your teacher assigned a lesson, but the lesson details are unavailable right now.'
      : 'No teacher lesson assigned for this class yet.'

  const hasUserMessages = messages.some((message) => message.role === 'user')
  const hasAssignedLesson = hasTeacherAssignment && hasResolvedAssignedLessonTitle && hasAssignedLessonContent && assignedLesson?.is_active !== false
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


  function handleSessionModeToggle(nextMode) {
    if (nextMode === sessionMode) return
    if (nextMode === 'teacher_directed' && !hasAssignedLesson) return
    setSessionMode(nextMode)
    setInput('')
    setMessages(messagesForModeSwitch(nextMode, resolvedAssignedLessonTitle || 'your assigned lesson'))
  }

  async function commitSessionInterestInline() {
    const interest = sessionInterestInput.replace(/[<>]/g, '').trim().replace(/\s+/g, ' ').slice(0, 120)
    if (!interest) {
      setInterestStatus({ tone: 'error', text: 'Please enter an interest.' })
      return
    }
    if (interest === studentInterest) {
      setIsEditingSessionInterest(false)
      setInterestStatus({ tone: '', text: '' })
      return
    }
    setInterestSaving(true)
    setInterestStatus({ tone: '', text: '' })
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Please sign in again.')
      const response = await fetch('/api/student/interest', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ interest }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Could not save your interest.')
      setStudentInterest(payload.interest)
      setSessionInterestInput(payload.interest)
      setIsEditingSessionInterest(false)
      setInterestStatus({ tone: 'success', text: `Interest changed to ${payload.interest}. VIC will use it in new examples.` })
    } catch (error) {
      setSessionInterestInput(studentInterest)
      setInterestStatus({ tone: 'error', text: error?.message || 'Could not save your interest. Your previous interest is still saved.' })
    } finally {
      setInterestSaving(false)
    }
  }


  const messageAreaRef = useRef(null)
  const messageRefs = useRef([])
  const canvasRef = useRef(null)
  const isDrawingRef = useRef(false)
  const isErasingRef = useRef(false)
  const assignmentIntroKeyRef = useRef('')

  const detectStudentAndLesson = useCallback(async () => {
    setStudentLookupStatus('Loading student...')
    setCurrentUserStatus('Loading signed-in user...')






    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      setCurrentUserProfile(null)
      setCurrentUserStatus('Supabase is not configured.')
      setSelectedStudentId(null)
      setAssignedLesson(null)
      setHasTeacherAssignment(false)
      assignmentIntroKeyRef.current = ''
      setSessionMode('student_directed')
      setStudentSupportLevel('')
      setStudentGradeLevel('')
      setEnrolledClasses([])
      setActiveClassId(null)
      setStudentLookupStatus('Supabase is not configured. Ask VIC is in free mode.')
      return
    }

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
        setEnrolledClasses([])
        setActiveClassId(null)
        setStudentLookupStatus('Supabase is not configured. Ask VIC is in free mode.')
        return
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user?.email) {
        setCurrentUserProfile(null)



        setCurrentUserStatus('No signed-in user found.')
        setSelectedStudentId(null)
        setAssignedLesson(null)
        setHasTeacherAssignment(false)
        assignmentIntroKeyRef.current = ''
        setSessionMode('student_directed')
        setStudentSupportLevel('')
        setStudentGradeLevel('')
        setEnrolledClasses([])
        setActiveClassId(null)
        setStudentLookupStatus('Sign in required.')
        router.replace('/login')
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()
      const accessToken = session?.access_token || ''

      const classesResponse = await fetch('/api/student/classes', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const classesPayload = await classesResponse.json().catch(() => null)
      if (classesResponse.status === 401) {
        await supabase.auth.signOut()
        router.replace('/login')
        return
      }
      const matchedProfile = classesResponse.ok ? classesPayload?.profile || null : null
      setCurrentUserProfile(matchedProfile)


      setCurrentUserStatus(
        matchedProfile
          ? 'Signed in.'
          : 'Signed in user found, but no matching profile row in public.users.'
      )

      const resolvedRole = normalizeUserRole(
        matchedProfile?.role || user?.user_metadata?.role || user?.app_metadata?.role || ''
      )

      if (resolvedRole && resolvedRole !== 'student') {
        setSelectedStudentId(null)
        setAssignedLesson(null)
        setHasTeacherAssignment(false)
        assignmentIntroKeyRef.current = ''
        setSessionMode('student_directed')
        setStudentSupportLevel('')
        setStudentGradeLevel('')
        setEnrolledClasses([])
        setActiveClassId(null)
        setStudentLookupStatus('Signed in as non-student. Ask VIC is in free mode.')
        return
      }

      const student = matchedProfile

      if (!student?.id) {
        setSelectedStudentId(null)
        setAssignedLesson(null)
        setHasTeacherAssignment(false)
        assignmentIntroKeyRef.current = ''
        setSessionMode('student_directed')
        setStudentSupportLevel('')
        setStudentGradeLevel('')
        setEnrolledClasses([])
        setActiveClassId(null)
        setStudentLookupStatus('Could not match your student profile. Using free mode.')
        return
      }

      setSelectedStudentId(student.id)
      const interests = Array.isArray(student.interest_tags) ? student.interest_tags : []
      setStudentInterest(interests.join(', '))

      const classOptions = Array.isArray(classesPayload?.classes) ? classesPayload.classes : []
      const safeEnrollmentRows = classOptions.map((item) => ({
        class_id: item.id,
        support_level: item.supportLevel,
        classes: {
          id: item.id,
          class_name: item.className,
          class_code: item.classCode,
          grade_level: item.gradeLevel,
        },
      }))
      setEnrolledClasses(classOptions)
      const fallbackClassId = classOptions[0]?.id ?? null
      const hasExistingActiveClass = classOptions.some((option) => option.id === activeClassId)
      const resolvedActiveClassId = hasExistingActiveClass ? activeClassId : fallbackClassId
      if (activeClassId !== resolvedActiveClassId) {
        setActiveClassId(resolvedActiveClassId)
      }

      const activeEnrollment =
        safeEnrollmentRows.find((row) => Number(row?.class_id) === resolvedActiveClassId) || null
      const activeClassRow = Array.isArray(activeEnrollment?.classes)
        ? activeEnrollment.classes[0]
        : activeEnrollment?.classes
      setStudentGradeLevel(normalizeGradeLevel(activeClassRow?.grade_level))

      const {
        rows: assignmentRows,
        latestAssignment: latestAssignmentFromApi,
        assignedLesson: assignedLessonFromApi,
        error: assignmentError,
      } = await loadLatestAssignmentSafe(
        supabase,
        student.id,
        accessToken,
        resolvedActiveClassId
      )

      const activeEnrollmentSupportLevel = normalizeSupportLevel(activeEnrollment?.support_level)
      const filteredAssignmentRowsByClass =
        activeEnrollmentSupportLevel && safeEnrollmentRows.length > 1
          ? assignmentRows.filter(
              (row) => normalizeSupportLevel(row?.mode || '') === activeEnrollmentSupportLevel
            )
          : assignmentRows
      const latestAssignment =
        latestAssignmentFromApi || pickLatestAssignment(filteredAssignmentRowsByClass) || pickLatestAssignment(assignmentRows)
      let lessonRow = assignedLessonFromApi || lessonFromAssignment(latestAssignment)
      setDebugLatestAssignment({
        found: Boolean(latestAssignment?.id),
        id: latestAssignment?.id || null,
        lessonId: latestAssignment?.lesson_id || lessonRow?.id || null,
        lessonTitle: lessonRow?.title || null,
      })

      if (assignmentError || !latestAssignment?.id || !lessonRow) {
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
          setStudentLookupStatus('Teacher lesson found, but details are unavailable.')
          return
        }

        setAssignedLesson(null)
        setHasTeacherAssignment(false)
        assignmentIntroKeyRef.current = ''
        setStudentMode('')
        setStudentSupportLevel('')
        setSessionMode('student_directed')
        setStudentLookupStatus('Student detected. No assigned lesson found.')
        return
      }

      let enrollmentSupportLevel = ''
      const normalizedAssignmentMode = normalizeSupportLevel(latestAssignment.mode || '')

      if (activeEnrollment) {
        enrollmentSupportLevel = normalizeSupportLevel(activeEnrollment?.support_level)
      } else if (safeEnrollmentRows.length === 1) {
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
      setStudentLookupStatus(`Loaded assigned lesson: ${lessonRow.title || 'Untitled lesson'}`)
  }, [activeClassId])

  useEffect(() => {
    let active = true
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

    const runDetection = async () => {
      if (!active) return
      await detectStudentAndLesson()
    }

    runDetection()

    const authSubscription = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace('/login')
        return
      }
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

  useEffect(() => {
    if (!activeTool) return undefined
    const handleEscape = (event) => {
      if (event.key === 'Escape') setActiveTool(null)
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [activeTool])

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
}, [activeTool, isCompact, isMobile, viewportWidth])

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

    if (!trimmedOutgoing || loading) {
      return null
    }

    const userTextForThread = sketchImage ? `${outgoing}

[Sketch attached]` : outgoing
    const userMessage = { role: 'user', text: userTextForThread }
    const nextMessages = [...messages, userMessage]

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
      const apiMessages = nextMessages.map((msg) => ({
        role: msg.role,
        content: msg.text,
      }))

      const apiUrl = '/api/vic'

      const requestBody = {
        messages: apiMessages,
        sketchImage,
        activeClassId,
        sessionMode,
        studentInterest,
        gradeLevel: studentGradeLevel,
      }


      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        await supabase.auth.signOut()
        router.replace('/login')
        throw new Error('Your session has expired. Please sign in again.')
      }

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      })
      if (res.status === 401) {
        await supabase.auth.signOut()
        router.replace('/login')
        throw new Error('Your session has expired. Please sign in again.')
      }
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || 'VIC could not respond right now.')
      }
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

      return finalReply
    } catch (error) {
      const errorReply = error?.message || 'Something went wrong. Please try again.'
      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          text: errorReply,
          visual: {
            type: 'tip',
            title: 'Quick fix',
            body: 'Try sending the message again. If it keeps happening, ask an adult for help.',
          },
        },
      ])
      return errorReply
    } finally {
      setLoading(false)
    }
  }


  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  async function handleJoinClass() {
    const trimmedClassCode = joinClassCode.trim()
    if (!trimmedClassCode || joinClassLoading) return

    if (!supabase) {
      setJoinClassStatus({ tone: 'error', text: 'Not authenticated. Please sign in again.' })
      return
    }

    setJoinClassLoading(true)
    setJoinClassStatus({ tone: '', text: '' })

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const accessToken = session?.access_token || ''

      if (!accessToken) {
        setJoinClassStatus({ tone: 'error', text: 'Not authenticated. Please sign in again.' })
        return
      }

      const response = await fetch('/api/join-class', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ classCode: trimmedClassCode }),
      })

      const payload = await response.json().catch(() => null)
      const payloadMessage = typeof payload?.message === 'string' ? payload.message : ''
      const payloadError = typeof payload?.error === 'string' ? payload.error : ''
      const normalizedPayloadText = `${payloadMessage} ${payloadError}`.toLowerCase()

      if (response.ok && payload?.success && payloadMessage.toLowerCase() === 'already enrolled') {
        setJoinClassStatus({ tone: 'info', text: 'Already enrolled in that class.' })
        await detectStudentAndLesson()
        return
      }

      if (response.ok && payload?.success) {
        setJoinClassCode('')
        setJoinClassStatus({ tone: 'success', text: 'Joined class successfully.' })
        await detectStudentAndLesson()
        return
      }

      if (response.status === 401 || normalizedPayloadText.includes('not authenticated')) {
        setJoinClassStatus({ tone: 'error', text: 'Not authenticated. Please sign in again.' })
        return
      }

      if (response.status === 404 && normalizedPayloadText.includes('invalid class code')) {
        setJoinClassStatus({ tone: 'error', text: 'Invalid class code.' })
        return
      }

      if (normalizedPayloadText.includes('invalid class code')) {
        setJoinClassStatus({ tone: 'error', text: 'Invalid class code.' })
        return
      }

      setJoinClassStatus({ tone: 'error', text: payloadError || 'Could not join class right now.' })
    } catch (_error) {
      setJoinClassStatus({ tone: 'error', text: 'Could not join class right now.' })
    } finally {
      setJoinClassLoading(false)
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

    const styles = buildStyles({ isMobile, isTablet, isCompact })

  const heroSection = (
    <section style={styles.controlCenterCard}>
      <div style={styles.controlCenterHeader}>
        <div style={styles.sectionEyebrow}>Student controls</div>
        <div style={styles.controlCenterTitle}>Control Center</div>
        <div style={styles.controlCenterSubtext}>Manage your mode, class, and interest.</div>
      </div>

      <div style={styles.controlCenterSection}>
        <div style={styles.controlCenterSectionLabel}>Mode</div>
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
            style={sessionMode === 'student_directed' ? styles.sessionModeButtonActive : styles.sessionModeButton}
          >
            My Own Work
          </button>
        </div>
      </div>

      <div style={styles.controlCenterSection}>
        <div style={styles.controlCenterSectionLabel}>Class</div>
        <div style={styles.joinClassControlWrap}>
          <label style={styles.classSwitcherControlLabel}>
            <span style={styles.classSwitcherControlLabelText}>Class</span>
            <select
              value={activeClassId ?? ''}
              onChange={(event) => setActiveClassId(Number(event.target.value) || null)}
              style={styles.classSwitcherControlSelect}
              aria-label="Class"
              disabled={!selectedStudentId || enrolledClasses.length === 0}
            >
              {enrolledClasses.length === 0 ? (
                <option value="">No classes yet</option>
              ) : null}
              {enrolledClasses.map((enrolledClass) => (
                <option key={enrolledClass.id} value={enrolledClass.id}>
                  {enrolledClass.className || enrolledClass.classCode || `Class ${enrolledClass.id}`}
                </option>
              ))}
            </select>
          </label>

          {enrolledClasses.length === 0 ? (
            <>
              <div style={styles.joinClassFallbackText}>Not enrolled yet? Enter the class code from your teacher.</div>
              <div style={styles.joinClassControlRow}>
            <input
              type="text"
              value={joinClassCode}
              onChange={(event) => setJoinClassCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleJoinClass()
                }
              }}
              placeholder="Class code"
              style={styles.joinClassControlInput}
              aria-label="Class code"
            />
            <button
              type="button"
              onClick={handleJoinClass}
              disabled={joinClassLoading || !joinClassCode.trim()}
              style={
                joinClassLoading || !joinClassCode.trim()
                  ? styles.joinClassControlButtonDisabled
                  : styles.joinClassControlButton
              }
            >
              {joinClassLoading ? 'Joining…' : 'Join class'}
            </button>
              </div>
            </>
          ) : (
            <div style={styles.enrolledClassGrid}>
              {enrolledClasses.map((enrolledClass) => (
                <button
                  key={enrolledClass.id}
                  type="button"
                  onClick={() => setActiveClassId(enrolledClass.id)}
                  style={enrolledClass.id === activeClassId ? styles.enrolledClassCardActive : styles.enrolledClassCard}
                >
                  <strong>{enrolledClass.className || `Class ${enrolledClass.id}`}</strong>
                  <span>{enrolledClass.id === activeClassId ? 'Selected • Ask VIC' : 'Select class'}</span>
                </button>
              ))}
            </div>
          )}
          {joinClassStatus.text ? (
            <div
              style={
                joinClassStatus.tone === 'success'
                  ? styles.joinClassStatusSuccess
                  : joinClassStatus.tone === 'info'
                    ? styles.joinClassStatusInfo
                    : styles.joinClassStatusError
              }
            >
              {joinClassStatus.text}
            </div>
          ) : null}
        </div>
      </div>

      <div style={styles.controlCenterSection}>
        <div style={styles.controlCenterSectionLabel}>Interest</div>
        <div style={styles.sessionInterestInline}>
          <span style={styles.sessionInterestInlineLabel}>Interest:</span>
          {isEditingSessionInterest ? (
            <input
              id="session-interest-input"
              type="text"
              value={sessionInterestInput}
              onChange={(e) => setSessionInterestInput(e.target.value)}
                            onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commitSessionInterestInline()
                }
              }}
              placeholder="Set interest"
              style={styles.sessionInterestInlineInput}
              maxLength={120}
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setSessionInterestInput(studentInterest || '')
                setIsEditingSessionInterest(true)
              }}
              style={styles.sessionInterestInlineValue}
            >
              {studentInterest || 'None (Set)'}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setSessionInterestInput(studentInterest || '')
              setIsEditingSessionInterest(true)
            }}
            aria-label="Change interest"
            disabled={interestSaving}
            style={styles.sessionInterestInlineEdit}
          >
            {studentInterest ? 'Change' : 'Set'}
          </button>
        </div>
        {interestStatus.text ? <div style={interestStatus.tone === 'success' ? styles.joinClassStatusSuccess : styles.joinClassStatusError} role="status">{interestStatus.text}</div> : null}
      </div>
    </section>
  )


  const toolsSection = (
    <section style={styles.toolsCard}>
      <div style={styles.toolsHeaderRow}>
        <div style={styles.toolsHeaderText}>
          <div style={styles.sectionEyebrow}>Workspace</div>
          <div style={styles.sectionTitle}>Student Tools</div>
          <div style={styles.toolsSubtext}>Click a tool to open your large workspace. Your work stays here while you switch tools.</div>
        </div>
      </div>
      <div style={styles.toolLauncherGrid}>
        {['practice', 'sketch', 'notes', 'calculator'].map((tool) => (
          <button key={tool} type="button" style={styles.toolLauncher} onClick={() => setActiveTool(tool)}>
            {tool[0].toUpperCase() + tool.slice(1)}
          </button>
        ))}
      </div>
    </section>
  )

  const toolModal = activeTool ? (
    <div style={styles.toolModalBackdrop} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) setActiveTool(null)
    }}>
      <section style={styles.toolModal} role="dialog" aria-modal="true" aria-labelledby="student-tool-title">
        <div style={styles.toolModalHeader}>
          <div>
            <div style={styles.sectionEyebrow}>Student workspace</div>
            <div id="student-tool-title" style={styles.sectionTitle}>{activeTool[0].toUpperCase() + activeTool.slice(1)}</div>
          </div>
          <button type="button" autoFocus style={styles.toolCloseButton} onClick={() => setActiveTool(null)}>Close</button>
        </div>
        <div style={styles.toolModalBody}>
          {activeTool === 'practice' ? <>
            <textarea aria-label="Practice workspace" value={workArea} onChange={(e) => setWorkArea(e.target.value)} placeholder="Work out your thinking here..." style={styles.modalTextarea} />
            <div style={styles.supportRowTwoUp}><button style={styles.supportButtonWhite} onClick={requestHint}>Hint</button><button style={styles.supportButtonWhiteStrong} onClick={requestAskVICAboutThis}>Ask VIC About This</button></div>
          </> : null}
          {activeTool === 'notes' ? <>
            <textarea aria-label="Notes workspace" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Save important ideas here..." style={styles.modalTextarea} />
            <div style={styles.supportRowTwoUp}><button style={styles.supportButtonWhite} onClick={requestHint}>Hint</button><button style={styles.supportButtonWhiteStrong} onClick={requestAskVICAboutThis}>Ask VIC About This</button></div>
          </> : null}
          {activeTool === 'sketch' ? <>
            <div style={styles.sketchToolbar}><button style={styles.sketchToolButton} onClick={() => setCanvasMode('draw')}>Pen</button><button style={styles.sketchToolButton} onClick={() => setCanvasMode('erase')}>Erase</button><button style={styles.sketchToolButton} onClick={clearCanvas}>Clear</button></div>
            <div style={styles.modalCanvasWrap}><canvas aria-label="Sketch workspace" ref={canvasRef} style={styles.sketchCanvas} onPointerDown={startCanvasStroke} onPointerMove={moveCanvasStroke} onPointerUp={stopCanvasStroke} onPointerLeave={stopCanvasStroke} /></div>
            <div style={styles.supportRowTwoUp}><button style={styles.supportButtonWhite} onClick={requestHint}>Hint</button><button style={styles.supportButtonWhiteStrong} onClick={discussSketch}>Discuss My Sketch</button></div>
          </> : null}
          {activeTool === 'calculator' ? <div style={styles.calculatorWorkspace}>
            <input aria-label="Calculator expression" value={calcInput} onChange={(e) => setCalcInput(e.target.value)} style={styles.calcInput} />
            <div style={styles.calcResultDark} aria-live="polite">{calcResult || 'Result will appear here.'}</div>
            <div style={styles.calculatorGrid}>{['7','8','9','/','4','5','6','*','1','2','3','-','0','.','(',')','+'].map((key) => <button key={key} style={styles.calculatorKey} onClick={() => setCalcInput((value) => value + key)}>{key}</button>)}<button style={styles.calculatorKey} onClick={() => setCalcInput('')}>Clear</button><button style={styles.calculatorEquals} onClick={runCalculator}>=</button></div>
          </div> : null}
        </div>
      </section>
    </div>
  ) : null

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
                <div style={styles.inputTitle}>Write your message to VIC</div>

                <div style={styles.inputHeaderRight}>
                  {!isMobile ? (
                    <div style={styles.inputHint}>Enter = send • Shift + Enter = new line</div>
                  ) : null}
                </div>
              </div>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={isMobile ? 3 : 3}
                placeholder={
                  sessionMode === 'teacher_directed' && assignedLesson
                    ? 'Send your opening line to begin this lesson...'
                    : 'Type what you want help with...'
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

            {toolModal}
          </div>
        </div>
      </div>
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

function buildStyles({ isMobile, isTablet, isCompact }) {
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

    controlCenterCard: {
      background: 'var(--vic-surface)',
      border: '1px solid var(--vic-border-soft)',
      borderRadius: isMobile ? '16px' : '18px',
      padding: isMobile ? '14px' : '16px',
      boxShadow: 'var(--vic-shadow-card)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      overflow: 'hidden',
      flexShrink: 0,
    },

    controlCenterHeader: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    },

    controlCenterTitle: {
      fontSize: isMobile ? '20px' : '22px',
      fontWeight: 800,
      color: 'var(--vic-text-primary)',
      lineHeight: 1.1,
    },

    controlCenterSubtext: {
      fontSize: '12px',
      color: 'var(--vic-text-secondary)',
      lineHeight: 1.35,
    },

    controlCenterSection: {
      display: 'flex',
      flexDirection: 'column',
      gap: '7px',
      paddingTop: '10px',
      borderTop: '1px solid var(--vic-border-soft)',
    },

    controlCenterSectionLabel: {
      fontSize: '11px',
      lineHeight: 1.2,
      fontWeight: 800,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--vic-text-secondary)',
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

    toolLauncherGrid: { display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(2, minmax(0, 1fr))', gap: '12px', marginTop: '18px' },
    toolLauncher: { minHeight: '68px', border: '2px solid var(--vic-accent)', borderRadius: '16px', background: 'var(--vic-surface)', color: 'var(--vic-accent)', fontSize: '18px', fontWeight: 800, cursor: 'pointer' },
    toolModalBackdrop: { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '8px' : '24px', background: 'rgba(15, 23, 42, 0.72)' },
    toolModal: { width: isMobile ? 'calc(100vw - 16px)' : '80vw', height: isMobile ? 'calc(100dvh - 16px)' : '80vh', maxWidth: '1100px', maxHeight: '850px', display: 'flex', flexDirection: 'column', borderRadius: isMobile ? '16px' : '24px', background: 'var(--vic-surface)', boxShadow: '0 24px 80px rgba(0,0,0,.35)', overflow: 'hidden' },
    toolModalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: isMobile ? '16px' : '22px 28px', borderBottom: '1px solid var(--vic-border)' },
    toolCloseButton: { minWidth: '100px', minHeight: '52px', border: 0, borderRadius: '14px', background: 'var(--vic-accent)', color: '#fff', fontSize: '17px', fontWeight: 800, cursor: 'pointer' },
    toolModalBody: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '16px', padding: isMobile ? '14px' : '24px', overflow: 'auto' },
    modalTextarea: { flex: 1, minHeight: '300px', width: '100%', resize: 'none', padding: '20px', border: '2px solid var(--vic-border)', borderRadius: '16px', fontSize: '20px', lineHeight: 1.55, color: 'var(--vic-ink)', background: '#fff', boxSizing: 'border-box' },
    modalCanvasWrap: { flex: 1, minHeight: '300px', border: '2px solid var(--vic-border)', borderRadius: '16px', overflow: 'hidden', background: SKETCH_BG_COLOR },
    calculatorWorkspace: { width: '100%', maxWidth: '620px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' },
    calculatorGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' },
    calculatorKey: { minHeight: '64px', border: '1px solid var(--vic-border)', borderRadius: '14px', background: '#fff', color: 'var(--vic-ink)', fontSize: '24px', fontWeight: 800, cursor: 'pointer' },
    calculatorEquals: { minHeight: '64px', gridColumn: 'span 3', border: 0, borderRadius: '14px', background: 'var(--vic-accent)', color: '#fff', fontSize: '28px', fontWeight: 800, cursor: 'pointer' },
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
      minHeight: isMobile ? '340px' : '560px',
      height: isMobile ? '340px' : '560px',
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
           width: isMobile ? 'calc(100vw - 24px)' : '50vw',
      height: isMobile ? '72vh' : '74vh',
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

    joinClassControlWrap: {
      display: 'flex',
      flexDirection: 'column',
      gap: '7px',
    },

    joinClassControlRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      flexWrap: 'wrap',
    },

    joinClassFallbackText: {
      color: 'var(--vic-text-secondary)',
      fontSize: '12px',
      lineHeight: 1.4,
    },

    enrolledClassGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
      gap: '8px',
    },

    enrolledClassCard: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      textAlign: 'left',
      border: '1px solid var(--vic-border)',
      borderRadius: '10px',
      background: 'var(--vic-surface)',
      color: 'var(--vic-text-primary)',
      padding: '10px',
      cursor: 'pointer',
    },

    enrolledClassCardActive: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      textAlign: 'left',
      border: '2px solid var(--vic-accent)',
      borderRadius: '10px',
      background: 'rgba(181, 83, 47, 0.10)',
      color: 'var(--vic-text-primary)',
      padding: '9px',
      cursor: 'pointer',
    },

    classSwitcherControlLabel: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: '6px',
      color: 'var(--vic-text-secondary)',
      fontSize: '11px',
      lineHeight: 1.2,
      fontWeight: 700,
    },

    classSwitcherControlLabelText: {
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
    },

    classSwitcherControlSelect: {
      width: '100%',
      borderRadius: '10px',
      border: '1px solid var(--vic-border)',
      background: 'var(--vic-surface)',
      color: 'var(--vic-text-primary)',
      padding: '8px 10px',
      boxSizing: 'border-box',
      outline: 'none',
      fontSize: '12px',
      lineHeight: 1.2,
      minHeight: '34px',
    },

    joinClassControlInput: {
      width: isMobile ? '140px' : '150px',
      borderRadius: '10px',
      border: '1px solid var(--vic-border)',
      background: 'var(--vic-surface)',
      color: 'var(--vic-text-primary)',
      padding: '8px 10px',
      boxSizing: 'border-box',
      outline: 'none',
      fontSize: '12px',
      lineHeight: 1.2,
    },

    joinClassControlButton: {
      border: '1px solid rgba(181, 83, 47, 0.34)',
      background: 'rgba(181, 83, 47, 0.12)',
      color: 'var(--vic-text-primary)',
      borderRadius: '10px',
      padding: '8px 11px',
      fontSize: '12px',
      lineHeight: 1.2,
      fontWeight: 800,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    },

    joinClassControlButtonDisabled: {
      border: '1px solid var(--vic-border-soft)',
      background: 'var(--vic-surface-muted)',
      color: 'var(--vic-disabled)',
      borderRadius: '10px',
      padding: '8px 11px',
      fontSize: '12px',
      lineHeight: 1.2,
      fontWeight: 800,
      cursor: 'not-allowed',
      whiteSpace: 'nowrap',
    },

    joinClassStatusSuccess: {
      fontSize: '11px',
      lineHeight: 1.25,
      color: '#166534',
    },

    joinClassStatusInfo: {
      fontSize: '11px',
      lineHeight: 1.25,
      color: 'var(--vic-text-secondary)',
    },

    joinClassStatusError: {
      fontSize: '11px',
      lineHeight: 1.25,
      color: '#b91c1c',
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
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '8px',
      flexWrap: isMobile ? 'wrap' : 'nowrap',
    },

    inputHeaderRight: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      minWidth: 0,
      flexShrink: 0,
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

    sessionInterestInline: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: isMobile ? '12px' : '13px',
      lineHeight: 1.2,
      color: 'var(--vic-text-secondary)',
      whiteSpace: 'nowrap',
      padding: isMobile ? '4px 6px' : '5px 8px',
      borderRadius: '999px',
      background: 'var(--vic-surface-muted)',
      border: '1px solid var(--vic-border-soft)',
    },

    sessionInterestInlineLabel: {
      fontWeight: 700,
      color: 'var(--vic-text-secondary)',
    },

    sessionInterestInlineInput: {
      width: isMobile ? '138px' : '170px',
      borderRadius: '999px',
      border: '1px solid var(--vic-border)',
      background: 'var(--vic-surface)',
      color: 'var(--vic-text-primary)',
      padding: '6px 11px',
      boxSizing: 'border-box',
      outline: 'none',
      fontSize: '13px',
      lineHeight: 1.3,
    },

    sessionInterestInlineValue: {
      border: '1px solid var(--vic-border)',
      background: 'var(--vic-surface)',
      color: 'var(--vic-text-primary)',
      borderRadius: '999px',
      padding: '6px 12px',
      fontSize: '13px',
      fontWeight: 800,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      maxWidth: isMobile ? '135px' : '190px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },

    sessionInterestInlineEdit: {
      border: '1px solid var(--vic-border)',
      background: 'var(--vic-surface)',
      color: 'var(--vic-text-primary)',
      borderRadius: '999px',
      padding: '6px 10px',
      fontSize: '12px',
      lineHeight: 1.2,
      fontWeight: 700,
      cursor: 'pointer',
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

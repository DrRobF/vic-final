import { requireApprovedProfile } from '../../lib/server-auth'
import { releasedFilter } from '../../lib/release.mjs'
import { vicTargetText } from '../../lib/lesson-companion.mjs'
import { extractGoal } from '../../lib/vic-goal.mjs'
import {
  buildVicContext,
  normalizeSessionMode,
  selectActiveEnrollment,
  TEACHER_DIRECTED,
} from '../../lib/ask-vic-context.mjs'
import { respond, outputText } from '../../lib/openai.mjs'
import { VIC_BRAIN } from '../../lib/vic-brain.mjs'
import { detectSafety } from '../../lib/vic-safety.mjs'
import { extractVisual } from '../../lib/vic-visuals.mjs'
import { raiseSafetyAlert } from '../../lib/vic-safety-notify.js'
import { splitText, buildSpeech, policyForLesson, sessionInstructions } from '../../lib/read-aloud.mjs'
import { supportFor, levelFor, toLevel } from '../../lib/learner-profile.mjs'
import { conditionFor, attemptRow, resolvePatch, resultRow, levelSubjectFor, turnsIn } from '../../lib/vic-attempt.mjs'
import general from '../../data/lesson-standards.json'
import access from '../../data/access-points.json'

// Standards by id, so a practice skill's read-aloud policy can be looked up.
const standardsById = new Map([...general, ...access].map(x => [x.id, x]))

export const config = { api: { bodyParser: { sizeLimit: '8mb' } }, maxDuration: 60 }

const cleanInterest = (value) => typeof value === 'string' ? value.trim().slice(0, 120) : ''

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })

  const { messages, sketchImage, sessionMode, studentId, activeClassId, spoke } = req.body || {}
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Send at least one message.' })
  }

  const auth = await requireApprovedProfile(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })

  const mode = normalizeSessionMode(sessionMode)
  const requestedStudentId = Number(studentId)
  if (auth.profile.role !== 'student') {
    return res.status(403).json({ error: 'This page is for students. Teachers, open My Week.' })
  }
  if (Number.isFinite(requestedStudentId) && requestedStudentId !== auth.profile.id) {
    return res.status(403).json({ error: 'You may only access your own learning session.' })
  }

  try {
    const savedInterest = Array.isArray(auth.profile.interest_tags)
      ? auth.profile.interest_tags.map(cleanInterest).filter(Boolean).join(', ').slice(0, 120)
      : ''
    let context
    let assignedLessonRow = null
    let activityAssignment = null

    if (mode === TEACHER_DIRECTED) {
      const { data: enrollments, error: enrollmentError } = await auth.admin
        .from('enrollments')
        .select('class_id, support_level, classes:class_id(id, grade_level)')
        .eq('student_id', auth.profile.id)
        .order('class_id', { ascending: true })
      if (enrollmentError) throw enrollmentError

      const enrollment = selectActiveEnrollment(enrollments, activeClassId)
      if (!enrollment) {
        return res.status(403).json({ error: 'Your teacher hasn’t sent a lesson for this class yet.' })
      }

      // Deliberately use only columns present in the production assignment schema. The old
      // teacher-directed path selected/ordered by created_at, causing the request to fail
      // before OpenAI even ran on deployments where that optional column is absent.
      const { data: assignments, error: assignmentError } = await auth.admin
        .from('assignments')
        .select('id, lesson_id, mode, status, assigned_at, lessons!inner(id, class_id)')
        .eq('student_id', auth.profile.id)
        .eq('status', 'assigned')
        .eq('lessons.class_id', enrollment.class_id)
        .or(releasedFilter())
        .order('assigned_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false })
        .limit(20)
      if (assignmentError) throw assignmentError

      // Teach the lesson the student is looking at (sent by the screen); otherwise the newest one.
      const wantedLessonId = Number(req.body?.assignedLessonId)
      const assignment = (Number.isInteger(wantedLessonId) && wantedLessonId > 0 ? assignments?.find(a => Number(a.lesson_id) === wantedLessonId) : null) || assignments?.[0] || null
      if (!assignment?.lesson_id) {
        return res.status(409).json({ error: 'No active teacher lesson is available for the selected class.' })
      }
      activityAssignment = {student_id:auth.profile.id,class_id:enrollment.class_id,assignment_id:assignment.id}

      const { data: lessons, error: lessonError } = await auth.admin
        .from('lessons')
        .select('id, class_id, subject, title, lesson_text, is_active, source_lesson_id, practice_standard')
        .eq('id', assignment.lesson_id)
        .eq('class_id', enrollment.class_id)
        .limit(1)
      if (lessonError) throw lessonError
      const lesson = lessons?.[0] || null
      assignedLessonRow = lesson
      // Teachers can edit the lesson all week: VIC teaches the goals as they are now, not as they were when sent.
      if (lesson?.source_lesson_id) {
        try {
          const { data: src } = await auth.admin.from('educator_lessons').select('title,draft').eq('id', lesson.source_lesson_id).maybeSingle()
          if (src?.draft) { lesson.lesson_text = vicTargetText(src.draft); lesson.title = src.draft.plan?.title || src.title || lesson.title }
        } catch {}
      }
      const classRow = Array.isArray(enrollment.classes) ? enrollment.classes[0] : enrollment.classes
      context = buildVicContext({
        mode,
        lesson,
        assignmentMode: assignment.mode,
        supportLevel: enrollment.support_level,
        interest: savedInterest,
        gradeLevel: classRow?.grade_level,
      })
      if (!context) {
        return res.status(409).json({ error: 'The assigned lesson is not available right now. Please ask your teacher.' })
      }
    } else {
      // Assignment data is never queried or added to My Own Work context.
      context = buildVicContext({ mode, interest: savedInterest })
      const classId=Number(activeClassId)
      if(Number.isInteger(classId)&&classId>0){
        const {data:enrolled,error:openEnrollmentError}=await auth.admin.from('enrollments').select('class_id').eq('student_id',auth.profile.id).eq('class_id',classId).maybeSingle()
        if(openEnrollmentError)throw openEnrollmentError
        if(enrolled)activityAssignment={student_id:auth.profile.id,class_id:classId}
      }
    }

    // What this child has switched on (read-aloud, a language), and what this skill measures.
    // A child on the defaults gets no extra instructions and no speech plan: nothing changes for them.
    // The working level is read for the same reason: an attempt record has to say what level the
    // child was being taught at, because both the level and the grade move and a verdict earned in
    // October still has to be readable in May.
    let supports = null
    let working = null
    let enrolledGrade = null
    try {
      const subject = levelSubjectFor(assignedLessonRow?.subject)
      const [{ data: supportRow }, { data: levelRows }, { data: me }] = await Promise.all([
        auth.admin.from('student_supports').select('read_aloud,language,alternate_standards').eq('student_id', auth.profile.id).maybeSingle(),
        auth.admin.from('student_levels').select('subject,level,source,confirmed_at').eq('student_id', auth.profile.id),
        auth.admin.from('users').select('grade_level').eq('id', auth.profile.id).maybeSingle(),
      ])
      supports = supportRow || null
      enrolledGrade = me?.grade_level ?? null
      working = levelFor(levelRows || [], subject, enrolledGrade)
    } catch {}
    const standard = assignedLessonRow?.practice_standard ? standardsById.get(assignedLessonRow.practice_standard) || null : null
    const audioPolicy = policyForLesson({ standard, subjectName: assignedLessonRow?.subject, ownWork: mode !== TEACHER_DIRECTED })
    const translate = standard?.translate || (/math/i.test(assignedLessonRow?.subject || '') ? 'free' : 'scaffold_only')
    const supportNote = sessionInstructions({ policy: audioPolicy, translate, supports })
    if (supportNote) context += `\n\n${supportNote}`

    // Notes the adults running the student's VIC Room left for today ("work on 7s facts").
    try {
      const { data: notes } = await auth.admin.from('vic_room_notes').select('note').eq('student_id', auth.profile.id).eq('active', true).order('created_at', { ascending: true }).limit(5)
      if (notes?.length) context += `\n\nNotes from the adults in this student's room today (follow them where they fit the lesson; do not quote them word for word unless asked):\n${notes.map(n => `- ${String(n.note).slice(0, 600)}`).join('\n')}`
    } catch {}

    const safeMessages = messages
      .filter((message) => message && ['user', 'assistant'].includes(message.role))
      .map((message) => ({ role: message.role, content: typeof message.content === 'string' ? message.content : '' }))
    // Long sessions: only the most recent turns go back to the model. The lesson itself is in the
    // system context, so nothing important is lost, and replies stay fast at minute 80.
    const recent = safeMessages.slice(-24)
    while (recent.length && recent[0].role !== 'user') recent.shift()
    const input = [{ role: 'system', content: context }, ...recent]
    if (typeof sketchImage === 'string' && sketchImage.startsWith('data:image/') && input.at(-1)?.role === 'user') {
      input[input.length - 1] = {
        role: 'user',
        content: [
          { type: 'input_text', text: input.at(-1).content },
          { type: 'input_image', image_url: sketchImage, detail: 'high' },
        ],
      }
    }

    // VIC's teaching brain ships with the code (lib/vic-brain.mjs). It used to be a hosted prompt in
    // the OpenAI dashboard. store:false keeps children's conversations out of OpenAI's stored logs,
    // matching every other AI call in this app.
    const { response, data, model } = await respond('vicChat', {
      instructions: VIC_BRAIN,
      input,
      store: false,
      max_output_tokens: 4000,
    }, { timeoutMs: 22000, budgetMs: 52000 })
    if (!response.ok) {
      console.error('VIC provider request failed.', { status: response.status, mode, model })
      return res.status(503).json({ error: 'VIC is very busy right now. Wait a few seconds and send your message again.' })
    }

    const rawReply = outputText(data)
    if (!rawReply) return res.status(502).json({ error: 'VIC returned an empty response. Please try again.' })

    // Student safety: VIC's own flag or the keyword backstop tells the teacher. The flag line is
    // removed before the student sees the reply. Awaited so the alert is not lost when the
    // serverless function ends after responding.
    const studentText = safeMessages.at(-1)?.role === 'user' ? safeMessages.at(-1).content : ''
    const safety = detectSafety({ studentText, reply: rawReply })
    // VIC may end a reply with one [[VIC_VISUAL: ...]] tag; it is checked, removed and drawn by the page.
    // A safety reply never carries a visual.
    const goalTag = extractGoal(safety.reply)
    const shown = extractVisual(goalTag.text)
    const visual = safety.category ? null : shown.visual
    const marked = splitText(shown.text)
    const reply = marked.text || 'Thank you for telling me. That matters, and you did the right thing. I’m going to let your teacher know so a grown-up can help. Please tell a trusted adult today, like your teacher, school counselor, or someone in your family. If you are in danger right now, go to an adult or call 911. You can also call or text 988 any time.'
    if (safety.category) {
      await raiseSafetyAlert({ admin: auth.admin, student: auth.profile, classId: activityAssignment?.class_id ?? Number(activeClassId), category: safety.category, source: safety.source, studentText, vicReply: reply })
    }
    if (activityAssignment && input.at(-1)?.role === 'user') {
      try {
        const table=activityAssignment.assignment_id?'vic_activity_snapshots':'vic_open_work_snapshots'
        let query=auth.admin.from(table).select('turns').eq('student_id',activityAssignment.student_id).eq('class_id',activityAssignment.class_id)
        if(activityAssignment.assignment_id)query=query.eq('assignment_id',activityAssignment.assignment_id)
        const {data:previous,error:readError}=await query.maybeSingle()
        if(readError)throw readError
        const userText=safeMessages.at(-1)?.content?.slice(0,1200)||''
        const turns=[...(Array.isArray(previous?.turns)?previous.turns:[]),{student:userText,vic:String(reply).slice(0,1800)}].slice(-20)
        const {error:saveError}=await auth.admin.from(table).upsert({...activityAssignment,turns,updated_at:new Date().toISOString()},{onConflict:activityAssignment.assignment_id?'student_id,class_id,assignment_id':'student_id,class_id'})
        if(saveError)throw saveError
      }catch(saveError){console.error('Could not save VIC activity',{name:saveError?.name})}
    }
    // The attempt record: one row per assignment, opened the first time the child works it and
    // kept current after that. This is what gives the evidence a denominator -- without it a
    // child who worked eight standards and met three is indistinguishable from one who worked
    // three, and a child who never got there leaves no trace at all. A safety reply is not
    // schoolwork, so it does not count as a turn.
    const condition = conditionFor({
      support: supportFor({ audio: audioPolicy, translate }, supports),
      spoke: spoke === true,
      alternateStandard: Boolean(supports?.alternate_standards),
    })
    const onTask = !safety.category && activityAssignment?.assignment_id && assignedLessonRow
    let attemptId = null
    if (onTask) {
      try {
        const row = attemptRow({
          studentId: auth.profile.id,
          classId: activityAssignment.class_id,
          lessonId: assignedLessonRow.id,
          assignmentId: activityAssignment.assignment_id,
          standardId: assignedLessonRow.practice_standard || null,
          condition,
          level: working?.level ?? null,
          enrolledGrade: toLevel(enrolledGrade),
          turns: turnsIn(messages),
        })
        const { data: saved, error: attemptError } = await auth.admin
          .from('vic_goal_attempts')
          .upsert(row, { onConflict: 'assignment_id' })
          .select('id')
          .maybeSingle()
        if (attemptError) throw attemptError
        attemptId = saved?.id ?? null
      } catch (attemptError) {
        // Evidence is worth having, but never at the cost of the child's lesson.
        console.error('VIC attempt not recorded', { code: attemptError?.code })
      }
    }

    // VIC's verdict on this lesson or practice skill: the evidence behind "on level" and red flags.
    let goal = null
    if (goalTag.goal && onTask) {
      goal = goalTag.goal
      const { error: goalError } = await auth.admin.from('vic_goal_results').insert(resultRow({
        studentId: auth.profile.id,
        classId: activityAssignment.class_id,
        lessonId: assignedLessonRow.id,
        assignmentId: activityAssignment.assignment_id,
        standardId: assignedLessonRow.practice_standard || null,
        verdict: goal,
        practice: !!assignedLessonRow.practice_standard,
        attemptId,
        condition,
      }))
      if (goalError) console.error('VIC goal result not saved', { code: goalError.code })
      // The verdict closes the attempt, so it stops counting as unfinished work.
      const patch = resolvePatch(goal)
      if (patch && attemptId) {
        const { error: closeError } = await auth.admin.from('vic_goal_attempts').update(patch).eq('id', attemptId).is('resolved_at', null)
        if (closeError) console.error('VIC attempt not resolved', { code: closeError.code })
      }
    }

    // May this reply be spoken, and which parts? Null for a child who uses neither read-aloud nor a language.
    // A safety reply is comfort, not assessment, so it is always free to speak.
    const speech = buildSpeech({ marked: safety.category ? splitText(reply) : marked, policy: safety.category ? 'free' : audioPolicy, translate, supports })

    return res.status(200).json({ reply, visual, goal, practice: !!assignedLessonRow?.practice_standard, ...(speech ? { speech } : {}) })
  } catch (error) {
    console.error('VIC request failed.', { name: error?.name, mode })
    return res.status(500).json({ error: 'VIC could not load this learning session. Please try again.' })
  }
}

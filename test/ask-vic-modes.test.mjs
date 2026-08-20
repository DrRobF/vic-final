import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildVicContext,
  messagesForModeSwitch,
  normalizeSupportLevel,
  selectActiveAssignment,
  selectActiveEnrollment,
} from '../lib/ask-vic-context.mjs'

const lesson = { title: 'counting to 10', lesson_text: 'Count objects from one through ten.', subject: null, is_active: true }

test('My Own Work gets no assigned-lesson context and permits a chosen topic', () => {
  const context = buildVicContext({ mode: 'student_directed', lesson, interest: 'soccer' })
  assert.doesNotMatch(context, /counting to 10|teacher assignment/i)
  assert.match(context, /topic or task the student chooses/i)
})

test('Teacher Lesson gets trusted context and redirects topic changes', () => {
  const context = buildVicContext({ mode: 'teacher_directed', lesson, assignmentMode: 'on-level', supportLevel: 'core' })
  assert.match(context, /Assigned objective: counting to 10/)
  assert.match(context, /Never silently change academic topics/)
  assert.match(context, /redirect to counting to 10/)
})

test('interest personalizes without replacing the teacher objective', () => {
  const context = buildVicContext({ mode: 'teacher_directed', lesson, interest: 'dinosaurs' })
  assert.match(context, /CURRENT saved student interest \(personalization only\): dinosaurs/)
  assert.match(context, /never replace the objective/i)
})

test('switching modes rebuilds rather than reuses previous messages', () => {
  const teacher = messagesForModeSwitch('teacher_directed', lesson.title)
  const own = messagesForModeSwitch('student_directed', lesson.title)
  assert.equal(teacher.length, 1)
  assert.equal(own.length, 1)
  assert.doesNotMatch(own[0].text, /counting to 10|Teacher Lesson/)
})

test('missing or cross-class enrollment cannot resolve an assignment', () => {
  const enrollments = [{ class_id: 4, support_level: 'core' }]
  assert.equal(selectActiveEnrollment(enrollments, 5), null)
  assert.equal(selectActiveAssignment([{ id: 40, mode: 'on-level', status: 'assigned' }], null), null)
})

test('on-level assignment maps to core enrollment without changing stored meaning', () => {
  assert.equal(normalizeSupportLevel('on-level'), 'core')
  const assignment = { id: 40, class_id: 4, mode: 'on-level', status: 'assigned' }
  assert.equal(selectActiveAssignment([assignment], { class_id: 4, support_level: 'core' }), assignment)
})

test('teacher-directed context accepts a null lesson subject', () => {
  assert.ok(buildVicContext({ mode: 'teacher_directed', lesson }))
})

test('inactive or incomplete assignments disable Teacher Lesson', () => {
  assert.equal(buildVicContext({ mode: 'teacher_directed', lesson: { ...lesson, is_active: false } }), null)
  assert.equal(buildVicContext({ mode: 'teacher_directed', lesson: { ...lesson, lesson_text: '' } }), null)
})

test('student page does not render temporary debug information', async () => {
  const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../pages/askvic.js', import.meta.url), 'utf8'))
  assert.doesNotMatch(source, /TEMP DEBUG|latest-assignment API response JSON|auth user id:/)
})

test('class-scoped assignments never leak between Math and Reading ELA', () => {
  const readingEnrollment = { class_id: 11, support_level: 'core' }
  const assignments = [
    { id: 2, class_id: 10, lesson_id: 90, mode: 'on-level', status: 'assigned' },
    { id: 1, class_id: 11, lesson_id: 91, mode: 'on-level', status: 'assigned' },
  ]
  assert.equal(selectActiveAssignment(assignments, readingEnrollment)?.lesson_id, 91)
  assert.equal(selectActiveAssignment(assignments, { class_id: 12, support_level: 'core' }), null)
})

test('student tools are launchers for a persistent modal workspace and Start Actions are absent', async () => {
  const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../pages/askvic.js', import.meta.url), 'utf8'))
  for (const tool of ['practice', 'sketch', 'notes', 'calculator']) {
    assert.match(source, new RegExp(`setActiveTool\\('${tool}'\\)|'${tool}'`))
  }
  assert.match(source, /role="dialog" aria-modal="true"/)
  assert.match(source, /event\.key === 'Escape'/)
  assert.match(source, /value=\{workArea\}/)
  assert.match(source, /value=\{notes\}/)
  assert.doesNotMatch(source, /Start actions|Get Homework Help|entryIntent/)
})

test('VIC requests use the freshly persisted profile interest, not a stale client payload', async () => {
  const api = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../pages/api/vic.js', import.meta.url), 'utf8'))
  assert.match(api, /auth\.profile\.interest_tags/)
  assert.doesNotMatch(api, /studentInterest|entryIntent/)
  const context = buildVicContext({ mode: 'student_directed', interest: 'sports' })
  assert.match(context, /CURRENT saved student interest.*sports/i)
  assert.match(context, /older interest.*stale/i)
})

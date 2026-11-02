import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { detectSafety, extractSafetyMarker, screenStudentMessage, safetyEmail } from '../lib/vic-safety.mjs'
import { raiseSafetyAlert } from '../lib/vic-safety-notify.js'
import { VIC_BRAIN } from '../lib/vic-brain.mjs'

test('brain has the safety rules, one visuals rule, and the schools’ standards', () => {
  assert.match(VIC_BRAIN, /STUDENT SAFETY \(HIGHEST PRIORITY/)
  assert.match(VIC_BRAIN, /\[\[VIC_SAFETY_ALERT: category\]\]/)
  assert.match(VIC_BRAIN, /Never promise to keep it secret/)
  assert.match(VIC_BRAIN, /988/)
  assert.match(VIC_BRAIN, /Florida B\.E\.S\.T\./)
  assert.match(VIC_BRAIN, /Pennsylvania Core/)
  assert.match(VIC_BRAIN, /Common Core/)
  assert.doesNotMatch(VIC_BRAIN, /You MUST suggest tools|DO NOT wait for the student to choose tools|Get your sketch pad|Draw this now/)
  assert.equal((VIC_BRAIN.match(/TOOL USAGE/g) || []).length, 0)
})

test('the safety flag is removed before a student sees it', () => {
  const r = extractSafetyMarker('Thank you for telling me.\n[[VIC_SAFETY_ALERT: self_harm]]')
  assert.equal(r.reply, 'Thank you for telling me.')
  assert.equal(r.category, 'self_harm')
  assert.equal(extractSafetyMarker('Hi\n[[VIC_SAFETY_ALERT: made_up]]').category, 'unsafe_situation')
  assert.equal(extractSafetyMarker('Let’s keep going with fractions.').category, '')
})

test('keyword backstop catches what a child might type', () => {
  for (const [text, want] of [
    ['i want to kill myself', 'self_harm'], ['sometimes i dont want to live anymore', 'self_harm'], ['I want to die', 'self_harm'],
    ['my dad hits me when he gets mad', 'harmed_by_someone'], ['my uncle touched me in a bad way', 'harmed_by_someone'], ['im scared to go home', 'harmed_by_someone'],
    ['im gonna bring a gun to school', 'danger_to_others'], ['I am not safe', 'unsafe_situation'],
  ]) assert.equal(screenStudentMessage(text), want, text)
})

test('ordinary kid talk does not set off an alert', () => {
  for (const text of ['this problem is killing me', 'you killed it!', 'I died laughing', 'im gonna kill the boss in minecraft', 'the knight hits the dragon', 'my sister hit a home run', 'what is 7 x 8']) assert.equal(screenStudentMessage(text), '', text)
})

test('either signal raises the alert, and the source is recorded', () => {
  assert.deepEqual(detectSafety({ studentText: 'my dad hits me', reply: 'I hear you.\n[[VIC_SAFETY_ALERT: harmed_by_someone]]' }), { reply: 'I hear you.', category: 'harmed_by_someone', source: 'vic+keywords' })
  assert.equal(detectSafety({ studentText: 'everything feels bad at home', reply: 'Thank you.\n[[VIC_SAFETY_ALERT: unsafe_situation]]' }).source, 'vic')
  assert.equal(detectSafety({ studentText: 'i want to kill myself', reply: 'Let’s talk.' }).source, 'keywords')
  assert.equal(detectSafety({ studentText: '3/4 + 1/4?', reply: 'Exactly — 1.' }).category, '')
})

test('teacher email names the concern and the student’s exact words', () => {
  const { subject, body } = safetyEmail({ studentName: 'Ava', className: 'Grade 4 Math', category: 'self_harm', studentText: 'i want to kill myself', vicReply: 'Thank you for telling me.' })
  assert.match(subject, /Ava/)
  assert.match(body, /hurting themselves/)
  assert.match(body, /"i want to kill myself"/)
  assert.match(body, /reporting procedures/)
})

function fakeAdmin({ recentSent = false, rooms = [], staff = [] } = {}) {
  const inserted = []
  const rows = {
    enrollments: [{ class_id: 7 }],
    classes: [{ id: 7, class_name: 'Grade 4 Math', teacher_id: 3 }],
    users: [{ id: 3, email: 'Teacher@School.org' }, ...staff],
    vic_rooms: rooms,
    vic_safety_alerts: recentSent ? [{ id: 1 }] : [],
  }
  return {
    inserted,
    from(table) {
      // Honours .in(column, values): the point of these tests is WHICH rows come back, so a
      // mock that returns the whole table cannot test recipient selection at all.
      let filter = null
      const data = () => filter ? (rows[table] || []).filter(r => filter.values.map(String).includes(String(r[filter.column]))) : rows[table]
      const q = {
        select: () => q, eq: () => q, gte: () => q, limit: () => q, overlaps: () => q,
        in: (column, values) => { filter = { column, values: values || [] }; return q },
        then: (ok, bad) => Promise.resolve({ data: data(), error: null }).then(ok, bad),
        insert: async row => { inserted.push(row); return { error: null } },
      }
      return q
    },
  }
}

test('an alert emails the class teacher and is recorded', async (t) => {
  process.env.RESEND_API_KEY = 'key'; process.env.REPORTS_FROM_EMAIL = 'vic@askvic.ai'
  let sent
  t.mock.method(globalThis, 'fetch', async (url, init) => { sent = { url, body: JSON.parse(init.body) }; return { ok: true } })
  const admin = fakeAdmin()
  const status = await raiseSafetyAlert({ admin, student: { id: 9, name: 'Ava' }, classId: 7, category: 'self_harm', source: 'vic', studentText: 'i want to kill myself', vicReply: 'Thank you.' })
  assert.equal(status, 'sent')
  assert.match(sent.url, /resend/)
  assert.deepEqual(sent.body.to, ['teacher@school.org'])
  assert.equal(admin.inserted[0].email_status, 'sent')
  assert.equal(admin.inserted[0].category, 'self_harm')
})

test('repeat alerts within 30 minutes are recorded but not re-emailed; unconfigured email is still recorded', async (t) => {
  t.mock.method(console, 'error', () => {})
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => { calls++; return { ok: true } })
  const admin = fakeAdmin({ recentSent: true })
  assert.equal(await raiseSafetyAlert({ admin, student: { id: 9, name: 'Ava' }, classId: 7, category: 'self_harm', source: 'vic', studentText: 'x', vicReply: 'y' }), 'suppressed_duplicate')
  assert.equal(calls, 0)
  assert.equal(admin.inserted.length, 1)
  delete process.env.RESEND_API_KEY
  const admin2 = fakeAdmin()
  assert.equal(await raiseSafetyAlert({ admin: admin2, student: { id: 9, name: 'Ava' }, classId: 7, category: 'self_harm', source: 'vic', studentText: 'x', vicReply: 'y' }), 'not_configured')
  assert.equal(admin2.inserted[0].email_status, 'not_configured')
})

test('VIC route raises the alert and only ever returns the cleaned reply', () => {
  const route = readFileSync(new URL('../pages/api/vic.js', import.meta.url), 'utf8')
  assert.match(route, /detectSafety\(\{ studentText, reply: rawReply \}\)/)
  assert.match(route, /await raiseSafetyAlert\(/)
  assert.doesNotMatch(route, /json\(\{ reply: rawReply/)
})

// Who hears about a child's disclosure. The room's staff list is who may open its screen --
// a principal has every reason to put most of the staff on it, to cover a room or to learn
// it -- and those people must not start receiving other people's children's disclosures.
test('the room\u2019s aide is told, and the rest of the room\u2019s staff are not', async (t) => {
  process.env.RESEND_API_KEY = 'key'; process.env.REPORTS_FROM_EMAIL = 'vic@askvic.ai'
  let sent
  t.mock.method(globalThis, 'fetch', async (_url, init) => { sent = JSON.parse(init.body); return { ok: true } })
  const admin = fakeAdmin({
    rooms: [{ aide_ids: [4], staff_ids: [4, 5, 6, 7] }],
    staff: [
      { id: 4, email: 'aide@school.org' },
      { id: 5, email: 'kindergarten@school.org' },
      { id: 6, email: 'prek@school.org' },
      { id: 7, email: 'ese@school.org' },
    ],
  })
  await raiseSafetyAlert({ admin, student: { id: 9, name: 'Ava' }, classId: 7, category: 'self_harm', source: 'vic', studentText: 'x', vicReply: 'y' })
  // The child's own teacher, and the adult on duty in the room. Nobody else.
  assert.deepEqual(sent.to.sort(), ['aide@school.org', 'teacher@school.org'])
  for (const other of ['kindergarten@school.org', 'prek@school.org', 'ese@school.org']) {
    assert.equal(sent.to.includes(other), false, `${other} should not receive another class's disclosure`)
  }
})

test('a room with no aide still reaches the child\u2019s own teacher', async (t) => {
  process.env.RESEND_API_KEY = 'key'; process.env.REPORTS_FROM_EMAIL = 'vic@askvic.ai'
  let sent
  t.mock.method(globalThis, 'fetch', async (_url, init) => { sent = JSON.parse(init.body); return { ok: true } })
  const admin = fakeAdmin({ rooms: [{ aide_ids: [], staff_ids: [5, 6] }], staff: [{ id: 5, email: 'kindergarten@school.org' }] })
  const status = await raiseSafetyAlert({ admin, student: { id: 9, name: 'Ava' }, classId: 7, category: 'self_harm', source: 'vic', studentText: 'x', vicReply: 'y' })
  assert.equal(status, 'sent')
  assert.deepEqual(sent.to, ['teacher@school.org'])
})

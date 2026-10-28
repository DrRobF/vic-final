import { safetyEmail } from './vic-safety.mjs'

// Server side of a safety alert: find the student's teacher(s), record the alert, email them.
// Never throws: a failure here must not stop the student from getting VIC's caring reply.
// Every outcome is written to vic_safety_alerts, including email failures, so nothing is silent.

const DUPLICATE_WINDOW_MS = 30 * 60 * 1000
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

async function teachersFor(admin, studentId, classId) {
  let classIds = Number.isInteger(classId) && classId > 0 ? [classId] : []
  if (!classIds.length) {
    const { data, error } = await admin.from('enrollments').select('class_id').eq('student_id', studentId)
    if (error) throw error
    classIds = [...new Set((data || []).map(r => Number(r.class_id)).filter(Number.isInteger))]
  }
  if (!classIds.length) return { emails: [], className: '' }
  const { data: classes, error: classError } = await admin.from('classes').select('id,class_name,teacher_id').in('id', classIds)
  if (classError) throw classError
  // In a VIC Room the adult in the room is the aide, not the class teacher: they hear about it too.
  //
  // Deliberately aide_ids and NOT staff_ids. staff_ids is only who may open the room's screen,
  // and a principal has every reason to put most of the staff on it -- to cover a room, or to
  // learn it. Those people must not start receiving other people's children's disclosures: it
  // is the child's privacy, and an alert that reaches people with nothing to do about it is an
  // alert people learn to skim. aide_ids is who is actually on duty for these children.
  //
  // Never let this extra lookup stop the alert reaching the class teacher.
  let roomAides = []
  try {
    const { data: rooms } = await admin.from('vic_rooms').select('aide_ids').overlaps('class_ids', classIds)
    roomAides = (rooms || []).flatMap(r => r.aide_ids || [])
  } catch {}
  const teacherIds = [...new Set([...(classes || []).map(c => c.teacher_id), ...roomAides].filter(Boolean))]
  if (!teacherIds.length) return { emails: [], className: classes?.[0]?.class_name || '' }
  const { data: teachers, error: teacherError } = await admin.from('users').select('id,email').in('id', teacherIds)
  if (teacherError) throw teacherError
  const emails = [...new Set((teachers || []).map(t => String(t.email || '').trim().toLowerCase()).filter(e => e.includes('@')))].slice(0, 10)
  const className = classIds.length === 1 ? classes?.[0]?.class_name || '' : (classes || []).map(c => c.class_name).filter(Boolean).join(', ')
  return { emails, className }
}

async function send({ to, subject, body, key }) {
  if (!process.env.RESEND_API_KEY || !process.env.REPORTS_FROM_EMAIL) return 'not_configured'
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ from: process.env.REPORTS_FROM_EMAIL, to, subject, text: body, html: `<div style="white-space:pre-wrap;font-family:Arial,sans-serif;line-height:1.6">${escapeHtml(body)}</div>` }),
    })
    if (!r.ok) { console.error('VIC safety email failed', { status: r.status }); return 'failed' }
    return 'sent'
  } catch (e) {
    console.error('VIC safety email failed', { name: e?.name })
    return 'failed'
  }
}

export async function raiseSafetyAlert({ admin, student, classId, category, source, studentText, vicReply }) {
  const now = new Date()
  let emails = [], className = '', status = 'pending'
  try {
    ;({ emails, className } = await teachersFor(admin, student.id, classId))
    const { data: recent } = await admin.from('vic_safety_alerts').select('id').eq('student_id', student.id).eq('category', category).eq('email_status', 'sent').gte('created_at', new Date(now - DUPLICATE_WINDOW_MS).toISOString()).limit(1)
    if (recent?.length) status = 'suppressed_duplicate'
    else if (!emails.length) status = 'no_recipient'
    else {
      const { subject, body } = safetyEmail({ studentName: student.name, className, category, studentText, vicReply, at: now })
      status = await send({ to: emails, subject, body, key: `vic-safety-${student.id}-${category}-${Math.floor(now / DUPLICATE_WINDOW_MS)}` })
    }
  } catch (e) {
    console.error('VIC safety alert lookup failed', { name: e?.name })
    status = 'failed'
  }
  const { error } = await admin.from('vic_safety_alerts').insert({
    student_id: student.id,
    class_id: Number.isInteger(classId) && classId > 0 ? classId : null,
    category, source,
    student_text: String(studentText || '').slice(0, 4000),
    vic_reply: String(vicReply || '').slice(0, 4000),
    notified_emails: status === 'sent' ? emails : [],
    email_status: status,
  })
  if (error) console.error('VIC safety alert could not be recorded', { code: error.code })
  if (status !== 'sent' && status !== 'suppressed_duplicate') console.error('VIC SAFETY ALERT NOT EMAILED', { studentId: student.id, category, status })
  return status
}

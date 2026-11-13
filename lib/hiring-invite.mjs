// The invitation email a candidate receives. Plain on purpose: it says who is inviting them, what
// they will be asked to do, and when the invitation runs out. It carries no product pitch and no
// marketing opt-in -- a candidate deciding whether to trust a school with their application is not
// a lead, and the person who owns the software is also the person deciding who gets hired.

import { VIDEO_LIMIT_SECONDS } from './hiring-media.mjs'

// The length a candidate is told comes from the limit the recorder actually enforces, so an email
// promising five minutes can never outlive a three-minute cap -- being cut off mid-answer by a rule
// nobody mentioned is the sort of thing a candidate rightly never forgives.
const MINUTES = Math.round(VIDEO_LIMIT_SECONDS / 60)

// The email is a template with a few {placeholders}. The wording belongs to the school and is saved
// per position; the deadline is not typed into it, it is filled in from the invitation itself, so
// the date a candidate is told and the moment their code stops working can never disagree.
export const INVITE_PLACEHOLDERS = [
 ['{first_name}', "the candidate's first name"],
 ['{school}', 'your school name'],
 ['{position}', 'the position title'],
 ['{link}', 'the interview web address'],
 ['{code}', "the candidate's personal code"],
 ['{deadline}', 'the exact date and time their code stops working'],
 ['{sender}', 'your name'],
]
const KNOWN = new Set(INVITE_PLACEHOLDERS.map(([k]) => k.slice(1, -1)))
const REQUIRED = ['link', 'code', 'deadline']

export const DEFAULT_INVITE_HOURS = 48

export const DEFAULT_INVITE_SUBJECT = 'Your {position} screening interview at {school}'

export const DEFAULT_INVITE_BODY = [
 'Hello {first_name},',
 '',
 'Thank you for applying to {school}. We would like you to complete the first step of our hiring process for the {position} position: a short screening interview you can do on your own time, from your phone or computer.',
 '',
 'What you will do:',
 '  • Attach your resume (PDF or Word)',
 `  • Answer five questions on video, up to ${MINUTES} minutes each. You can re-record any answer as many times as you like.`,
 '  • Write five short answers, a paragraph each',
 '',
 'Your link and your personal code:',
 '  {link}',
 '  Code: {code}',
 '',
 'Please finish and submit by {deadline}. The code stops working at that time, and it can be used on one device at a time. Nothing is sent to us until you press submit.',
 '',
 'Tell us about real children and real classrooms; a story beats a textbook answer every time. We read for what you say, not for polish, and how you look on camera is not scored.',
 '',
 'If you would rather not be recorded, or you have any trouble at all, just reply to this email or call the school office and we will arrange another way to interview.',
 '',
 'We look forward to meeting you.',
 '',
 '{sender}',
].join('\n')

// "Sunday, November 15 at 8:15 AM EST". Eastern time, because that is where the school is and
// where its office calls are answered; the zone is printed so nobody has to guess.
export function deadlineText(iso, timeZone = 'America/New_York') {
 const t = Date.parse(iso)
 if (!Number.isFinite(t)) return ''
 return new Date(t).toLocaleString('en-US', {
  weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone, timeZoneName: 'short',
 })
}

// Refuses a template a candidate could not use. Without {code} or {link} they cannot get in, and
// without {deadline} they are not told when the invitation ends. An unknown {placeholder} is almost
// always a typo, and shipping "Hello {frist_name}" to a stranger is worse than an error here.
export function checkTemplate(subject, body) {
 const sub = String(subject ?? '')
 const text = String(body ?? '')
 if (!sub.trim() || !text.trim()) return { ok: false, error: 'Write both a subject line and the message.' }
 if (sub.length > 200) return { ok: false, error: 'Keep the subject under 200 characters.' }
 if (text.length > 6000) return { ok: false, error: 'Keep the message under 6,000 characters.' }
 for (const key of REQUIRED) {
  if (!text.includes(`{${key}}`)) return { ok: false, error: `The message needs {${key}} in it so the candidate receives it.` }
 }
 for (const m of `${sub}\n${text}`.matchAll(/\{([a-z_]+)\}/gi)) {
  if (!KNOWN.has(m[1])) return { ok: false, error: `{${m[1]}} is not something this email can fill in. Check the spelling against the list.` }
 }
 return { ok: true }
}

export function renderInvite(template, vars) {
 const fill = text => String(text).replace(/\{([a-z_]+)\}/gi, (whole, key) => (KNOWN.has(key) ? String(vars[key] ?? '') : whole))
 return { subject: fill(template.subject), body: fill(template.body) }
}

export function inviteMessage({ name, schoolName, positionTitle, code, expiresAt, link, senderName, subject, body }) {
 const school = String(schoolName || 'our school').trim()
 return renderInvite(
  { subject: subject || DEFAULT_INVITE_SUBJECT, body: body || DEFAULT_INVITE_BODY },
  {
   first_name: String(name || '').trim().split(/\s+/)[0] || 'there',
   school, position: String(positionTitle || 'teaching').trim(),
   link, code, deadline: deadlineText(expiresAt),
   sender: String(senderName || '').trim() || school,
  },
 )
}

const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// 'sent', 'failed' or 'not_configured'. Never throws: a created invitation must not be lost
// because the mail provider hiccuped -- the panel still has the code on screen to send by hand.
export async function sendInvite({ to, replyTo, subject, body, key }, env = process.env, fetchImpl = fetch) {
 if (!env.RESEND_API_KEY || !env.REPORTS_FROM_EMAIL) return 'not_configured'
 try {
  const payload = {
   from: env.REPORTS_FROM_EMAIL, to, subject, text: body,
   html: `<div style="white-space:pre-wrap;font-family:Arial,sans-serif;line-height:1.6">${escapeHtml(body)}</div>`,
  }
  if (replyTo) payload.reply_to = replyTo
  const r = await fetchImpl('https://api.resend.com/emails', {
   method: 'POST',
   headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
   signal: AbortSignal.timeout(15000),
   body: JSON.stringify(payload),
  })
  if (!r.ok) { console.error('Hiring invite email failed', { status: r.status }); return 'failed' }
  return 'sent'
 } catch (e) {
  console.error('Hiring invite email failed', { name: e?.name })
  return 'failed'
 }
}

// The invitation email a candidate receives. Plain on purpose: it says who is inviting them, what
// they will be asked to do, and when the invitation runs out. It carries no product pitch and no
// marketing opt-in -- a candidate deciding whether to trust a school with their application is not
// a lead, and the person who owns the software is also the person deciding who gets hired.

const long = iso => {
 const t = Date.parse(iso)
 return Number.isFinite(t) ? new Date(t).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }) : ''
}

export function inviteMessage({ name, schoolName, positionTitle, code, expiresAt, link, senderName }) {
 const first = String(name || '').trim().split(/\s+/)[0] || 'there'
 const school = String(schoolName || 'our school').trim()
 const role = String(positionTitle || 'teaching').trim()
 const until = long(expiresAt)
 const subject = `Your ${role} screening interview at ${school}`
 const lines = [
  `Hello ${first},`,
  '',
  `Thank you for applying to ${school}. We would like you to complete the first step of our hiring process for the ${role} position: a short screening interview you can do on your own time, from your phone or computer.`,
  '',
  'What you will do:',
  '  • Attach your resume (PDF or Word)',
  '  • Answer five questions on video, up to five minutes each. You can re-record any answer as many times as you like.',
  '  • Write five short answers, a paragraph each',
  '',
  'Your link and your personal code:',
  `  ${link}`,
  `  Code: ${code}`,
  '',
  until ? `The code works until ${until}, and it can be used on one device at a time. Nothing is sent to us until you press submit.` : 'Nothing is sent to us until you press submit.',
  '',
  'Tell us about real children and real classrooms; a story beats a textbook answer every time. We read for what you say, not for polish, and how you look on camera is not scored.',
  '',
  'If you would rather not be recorded, or you have any trouble at all, just reply to this email or call the school office and we will arrange another way to interview.',
  '',
  'We look forward to meeting you.',
  '',
  String(senderName || '').trim() || school,
 ]
 return { subject, body: lines.join('\n') }
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

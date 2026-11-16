import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { reminderMessage, sendHiringMail, DEFAULT_REMINDER_BODY } from '../lib/hiring-invite.mjs'
import { verifySignature } from '../lib/mail-events.mjs'

test('a reminder reads as a second attempt and carries the live deadline', () => {
 const m = reminderMessage({
  name: 'Dana Whitfield', schoolName: 'Saint Peters Academy', positionTitle: 'Elementary Teacher',
  code: 'ABCD-EFGH', expiresAt: '2026-11-20T17:00:00Z', link: 'https://x.test/hiring-screening',
  senderName: 'Dr. Rob Furman',
 })
 assert.match(m.subject, /Still interested/)
 assert.match(m.body, /^Hello Dana,/)
 assert.match(m.body, /ABCD-EFGH/)
 // The junk-folder line is the point of the second email: the commonest reason for silence is
 // that the first one was never seen.
 assert.match(m.body, /junk/i)
 // The deadline is rendered from the invitation, never typed, so the date they are told cannot
 // outlive the code.
 assert.match(m.body, /November 20/)
 assert.doesNotMatch(m.body, /\{[a-z_]+\}/)
})

test('a reminder never invents a second code', () => {
 const a = reminderMessage({ name: 'A', code: 'SAME-CODE', expiresAt: '2026-11-20T17:00:00Z', link: 'l' })
 const b = reminderMessage({ name: 'A', code: 'SAME-CODE', expiresAt: '2026-11-21T17:00:00Z', link: 'l' })
 assert.match(a.body, /SAME-CODE/)
 assert.match(b.body, /SAME-CODE/)
})

test('the default reminder offers a way out as well as a way in', () => {
 // A candidate who has taken another job should be able to say so in one line. Without that the
 // school keeps chasing someone who is gone, and the candidate feels hounded.
 assert.match(DEFAULT_REMINDER_BODY, /taken another job/)
})

test('sendHiringMail returns the provider id so delivery can be matched later', async () => {
 const msg = { to: 'a@b.test', subject: 's', body: 'b', key: 'k' }
 assert.deepEqual(await sendHiringMail(msg, {}), { outcome: 'not_configured', providerId: null })
 const env = { RESEND_API_KEY: 'x', REPORTS_FROM_EMAIL: 'from@askvic.test' }
 let seen
 const ok = await sendHiringMail(msg, env, async (u, o) => {
  seen = { headers: o.headers, body: JSON.parse(o.body) }
  return { ok: true, json: async () => ({ id: 'msg_123' }) }
 })
 assert.deepEqual(ok, { outcome: 'sent', providerId: 'msg_123' })
 assert.equal(seen.headers['Idempotency-Key'], 'k')
 assert.deepEqual(await sendHiringMail(msg, env, async () => ({ ok: false, status: 500 })), { outcome: 'failed', providerId: null })
 assert.deepEqual(await sendHiringMail(msg, env, async () => { throw new Error('down') }), { outcome: 'failed', providerId: null })
})

test('a reminder uses a different idempotency key than the invitation it repeats', async () => {
 // The one that bites: reusing hiring-invite-<id> would have the provider silently treat the
 // reminder as a duplicate of the original and send nothing, while the screen reported success.
 const env = { RESEND_API_KEY: 'x', REPORTS_FROM_EMAIL: 'f@t.test' }
 const keys = []
 const spy = async (u, o) => { keys.push(o.headers['Idempotency-Key']); return { ok: true, json: async () => ({ id: 'm' }) } }
 await sendHiringMail({ to: 'a@b.test', subject: 's', body: 'b', key: 'hiring-invite-C1' }, env, spy)
 await sendHiringMail({ to: 'a@b.test', subject: 's', body: 'b', key: 'hiring-reminder-C1-1' }, env, spy)
 await sendHiringMail({ to: 'a@b.test', subject: 's', body: 'b', key: 'hiring-reminder-C1-2' }, env, spy)
 assert.equal(new Set(keys).size, 3)
})

const sign = (secret, id, ts, body) =>
 'v1,' + crypto.createHmac('sha256', Buffer.from(secret.replace(/^whsec_/, ''), 'base64')).update(`${id}.${ts}.${body}`).digest('base64')

test('delivery reports are accepted only when correctly signed and recent', () => {
 const secret = 'whsec_' + Buffer.from('a-test-signing-secret').toString('base64')
 const body = JSON.stringify({ type: 'email.delivered', data: { email_id: 'msg_1' } })
 const now = 1800000000000
 const ts = Math.floor(now / 1000)
 const good = { secret, id: 'ev_1', timestamp: ts, body, header: sign(secret, 'ev_1', ts, body) }

 assert.equal(verifySignature(good, now), true)
 assert.equal(verifySignature({ ...good, header: sign(secret, 'ev_1', ts, body) + 'x' }, now), false)
 assert.equal(verifySignature({ ...good, body: body.replace('msg_1', 'msg_2') }, now), false)
 // Replay: a correctly signed request from an hour ago is refused, because this endpoint writes.
 assert.equal(verifySignature(good, now + 3600000), false)
 assert.equal(verifySignature({ ...good, secret: '' }, now), false)
 // Several signatures during a rotation: any one matching is enough.
 assert.equal(verifySignature({ ...good, header: `v1,bogus ${sign(secret, 'ev_1', ts, body)}` }, now), true)
})

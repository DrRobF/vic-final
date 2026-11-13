import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inviteMessage, sendInvite } from '../lib/hiring-invite.mjs'

const base = { name: 'Dana Whitfield', schoolName: "Saint Peter's Academy", positionTitle: 'Elementary Teacher', code: 'ABCD-EFGH-JKLM', expiresAt: '2026-11-27T20:00:00Z', link: 'https://example.test/hiring-screening', senderName: 'Rob Furman' }

test('the invitation carries the link, the code and the deadline, addressed by first name', () => {
 const { subject, body } = inviteMessage(base)
 assert.match(subject, /Elementary Teacher/)
 assert.ok(body.startsWith('Hello Dana,'))
 assert.ok(body.includes('https://example.test/hiring-screening'))
 assert.ok(body.includes('ABCD-EFGH-JKLM'))
 assert.match(body, /November 27, 2026/)
 assert.ok(body.trim().endsWith('Rob Furman'))
})

test('the invitation offers a way out of recording and never pitches software', () => {
 const { body } = inviteMessage(base)
 assert.match(body, /rather not be recorded/i)
 assert.ok(!/askvic|subscribe|newsletter|marketing|demo of/i.test(body), 'a candidate email must not advertise')
})

test('sending reports not_configured, sent and failed without throwing', async () => {
 const msg = { to: 'a@b.test', replyTo: 'p@school.test', subject: 's', body: 'b', key: 'k' }
 assert.equal(await sendInvite(msg, {}), 'not_configured')
 const env = { RESEND_API_KEY: 'x', REPORTS_FROM_EMAIL: 'from@askvic.test' }
 let seen
 assert.equal(await sendInvite(msg, env, async (u, o) => { seen = JSON.parse(o.body); return { ok: true } }), 'sent')
 assert.equal(seen.reply_to, 'p@school.test')
 assert.equal(await sendInvite(msg, env, async () => ({ ok: false, status: 500 })), 'failed')
 assert.equal(await sendInvite(msg, env, async () => { throw new Error('down') }), 'failed')
})

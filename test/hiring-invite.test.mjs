import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
 inviteMessage, sendInvite, checkTemplate, renderInvite, deadlineText,
 DEFAULT_INVITE_SUBJECT, DEFAULT_INVITE_BODY, INVITE_PLACEHOLDERS,
} from '../lib/hiring-invite.mjs'

const base = { name: 'Dana Whitfield', schoolName: "Saint Peter's Academy", positionTitle: 'Elementary Teacher', code: 'ABCD-EFGH-JKLM', expiresAt: '2026-11-15T13:15:00Z', link: 'https://example.test/hiring-screening', senderName: 'Rob Furman' }

test('the invitation carries the link, the code and the deadline, addressed by first name', () => {
 const { subject, body } = inviteMessage(base)
 assert.match(subject, /Elementary Teacher/)
 assert.ok(body.startsWith('Hello Dana,'))
 assert.ok(body.includes('https://example.test/hiring-screening'))
 assert.ok(body.includes('ABCD-EFGH-JKLM'))
 assert.match(body, /Sunday, November 15.*8:15 AM E[SD]T/, 'the exact deadline, with its time zone')
 assert.ok(!/\{[a-z_]+\}/i.test(body), 'no placeholder may reach a candidate unfilled')
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

test('the standard email passes its own checks and names every fill-in it uses', () => {
 assert.deepEqual(checkTemplate(DEFAULT_INVITE_SUBJECT, DEFAULT_INVITE_BODY), { ok: true })
 const known = INVITE_PLACEHOLDERS.map(([k]) => k)
 for (const m of DEFAULT_INVITE_BODY.matchAll(/\{[a-z_]+\}/g)) assert.ok(known.includes(m[0]), `${m[0]} is not documented`)
})

test('a template that would strand a candidate is refused', () => {
 const ok = DEFAULT_INVITE_BODY
 assert.equal(checkTemplate('s', ok.replace('{code}', 'your code')).ok, false, 'no code')
 assert.equal(checkTemplate('s', ok.replace('{link}', 'the website')).ok, false, 'no link')
 assert.equal(checkTemplate('s', ok.replaceAll('{deadline}', 'soon')).ok, false, 'no deadline')
 assert.equal(checkTemplate('', ok).ok, false)
 assert.match(checkTemplate('s', `${ok}\n{frist_name}`).error, /frist_name/, 'a typo is named, not mailed')
})

test('a customised email is used as written and still gets the real deadline', () => {
 const { subject, body } = inviteMessage({ ...base, subject: 'Hi {first_name}', body: 'Go to {link} with {code}. Due {deadline}. {sender}' })
 assert.equal(subject, 'Hi Dana')
 assert.match(body, /^Go to https:\/\/example.test\/hiring-screening with ABCD-EFGH-JKLM\. Due Sunday, November 15/)
})

test('deadlines read in Eastern time, and a bad date is blank rather than wrong', () => {
 assert.match(deadlineText('2026-07-04T16:00:00Z'), /12:00 PM EDT/)
 assert.equal(deadlineText('nonsense'), '')
 assert.equal(renderInvite({ subject: 'x {nope}', body: 'y' }, {}).subject, 'x {nope}')
})

test('the email tells a candidate the length the recorder will actually allow', async () => {
 const { VIDEO_LIMIT_SECONDS } = await import('../lib/hiring-media.mjs')
 const minutes = Math.round(VIDEO_LIMIT_SECONDS / 60)
 assert.match(DEFAULT_INVITE_BODY, new RegExp(`up to ${minutes} minutes each`))
 // Being cut off mid-answer by a limit the invitation did not mention is unforgivable, so no other
 // number of minutes may appear in the standard wording.
 for (const m of DEFAULT_INVITE_BODY.matchAll(/(\d+|five|three|ten)\s+minutes/gi)) {
  assert.equal(m[1], String(minutes), `the email mentions ${m[0]} but the cap is ${minutes} minutes`)
 }
})

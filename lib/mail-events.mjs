import crypto from 'node:crypto'

// The delivery reports we act on. Anything else the provider sends is accepted and dropped --
// returning an error for an event we do not care about makes it retry forever.
export const EVENTS = {
 'email.delivered': 'delivered',
 'email.bounced': 'bounced',
 'email.complained': 'complained',
 'email.delivery_delayed': 'delivery_delayed',
}

export function rawBody(req) {
 return new Promise((resolve, reject) => {
  const chunks = []
  req.on('data', c => chunks.push(c))
  req.on('end', () => resolve(Buffer.concat(chunks)))
  req.on('error', reject)
 })
}

// Svix signing, which is what Resend uses. The signed payload is id.timestamp.body, the secret is
// base64 after its whsec_ prefix, and a request may carry several space-separated signatures during
// a secret rotation, so any one matching is enough.
//
// Compared in constant time and with the timestamp checked: without the timestamp an old signed
// request can be replayed forever, and this endpoint writes to the database.
export function verifySignature({ secret, id, timestamp, body, header }, now = Date.now()) {
 if (!secret || !id || !timestamp || !header) return false
 const age = Math.abs(now / 1000 - Number(timestamp))
 if (!Number.isFinite(age) || age > 300) return false
 const key = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64')
 const expected = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64')
 const expectedBuf = Buffer.from(expected)
 return String(header).split(' ').some(part => {
  const given = part.includes(',') ? part.split(',')[1] : part
  const givenBuf = Buffer.from(given || '')
  return givenBuf.length === expectedBuf.length && crypto.timingSafeEqual(givenBuf, expectedBuf)
 })
}


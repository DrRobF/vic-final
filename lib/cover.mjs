// Sub coverage, shared rules. Safe to import in the browser: the cover screen uses the same
// code shape and tidying as the server, so a typo is caught before it becomes a request.
//
// A grant hands one day's lessons to whoever is covering. It is deliberately narrow: named
// classes, one date, and no more power than putting those classes' planned lessons on screen.

// No I, O, 0 or 1: an adult is reading this off a printed slip, often in a hurry.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const COVER_CODE = /^[A-Z0-9]{8}$/

// Web Crypto rather than node:crypto, so this module stays importable in the browser.
// 256 is a whole number of 32s, so a byte modulo the alphabet is evenly spread -- no bias
// towards the first few letters, which is what makes a guessed code genuinely unlikely.
export function newCoverCode() {
 const bytes = new Uint8Array(8)
 globalThis.crypto.getRandomValues(bytes)
 return Array.from(bytes, b => CODE_CHARS[b % CODE_CHARS.length]).join('')
}

// Typed by hand, so forgive spaces, dashes and lower case before judging it.
export function tidyCoverCode(value) {
 return typeof value === 'string' ? value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) : ''
}

export function coverGrantInput(body) {
 const day = typeof body?.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.day) ? body.day : ''
 if (!day) throw new Error('Choose the day this cover is for.')
 const classIds = [...new Set((Array.isArray(body?.classIds) ? body.classIds : []).map(Number).filter(n => Number.isInteger(n) && n > 0))]
 if (!classIds.length) throw new Error('Choose at least one class to cover.')
 if (classIds.length > 40) throw new Error('That is too many classes for one cover slip.')
 const coveringName = typeof body?.coveringName === 'string' ? body.coveringName.trim().replace(/\s+/g, ' ').slice(0, 120) : ''
 if (coveringName.length < 2) throw new Error('Write who is covering, so the slip and the record have a name on them.')
 const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 300) : ''
 return { day, classIds, coveringName, note }
}

// A grant only works on its own day, and only until the principal takes it back.
export function grantUsable(grant, today) {
 if (!grant) return { ok: false, reason: 'notfound' }
 if (grant.revoked_at) return { ok: false, reason: 'revoked' }
 if (grant.day !== today) return { ok: false, reason: grant.day < today ? 'expired' : 'early' }
 return { ok: true }
}

// What the person holding the code is told. Deliberately vague about whether a code exists at
// all when it does not work, so the page cannot be used to hunt for live codes.
export const COVER_REFUSALS = {
 notfound: 'That code is not working. Check it with the office.',
 revoked: 'That code is not working. Check it with the office.',
 expired: 'That code was for an earlier day. Ask the office for today’s.',
 early: 'That code is for a later day. Ask the office for today’s.',
}

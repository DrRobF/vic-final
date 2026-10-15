import crypto from 'node:crypto'

// Staff check-in codes are never stored as typed. A keyed hash per school lets the kiosk find the person
// without anyone (including AskVic staff) being able to read a code back.
export function codeHash(secret, schoolId, code) {
 return crypto.createHmac('sha256', secret).update(`${schoolId}:${code}`).digest('hex')
}
export function tokenHash(token) { return crypto.createHash('sha256').update(String(token)).digest('hex') }
export function newToken() { return crypto.randomBytes(32).toString('base64url') }
// A short one-time code to turn on a kiosk from that computer, without a leader logging in there.
const SETUP_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export function newSetupCode() { const b = crypto.randomBytes(8); const c = [...b].map(x => SETUP_ALPHABET[x % SETUP_ALPHABET.length]).join(''); return `${c.slice(0, 4)}-${c.slice(4)}` }
export function normalizeSetupCode(v) { return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '') }
export const validCode = c => /^\d{4,6}$/.test(String(c || ''))

// First entry of the day clocks in, the second clocks out, a third is refused (the office fixes mistakes).
export function clockAction(punch) {
 if (!punch?.clock_in) return 'in'
 if (!punch.clock_out) return 'out'
 return 'done'
}

// Wrong-code protection per kiosk: 5 misses within 5 minutes locks the kiosk for 1 minute.
export function afterMiss(kiosk, now = Date.now()) {
 const windowStart = kiosk.fail_window_start ? Date.parse(kiosk.fail_window_start) : 0
 const fresh = !windowStart || now - windowStart > 5 * 60 * 1000
 const count = fresh ? 1 : (kiosk.fail_count || 0) + 1
 return { fail_count: count, fail_window_start: new Date(fresh ? now : windowStart).toISOString(), locked_until: count >= 5 ? new Date(now + 60 * 1000).toISOString() : null }
}
export function isLocked(kiosk, now = Date.now()) { return !!kiosk.locked_until && Date.parse(kiosk.locked_until) > now }

export { fmt12 } from './payroll.mjs'

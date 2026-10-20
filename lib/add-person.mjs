// Adding a person to a school -- the one place it happens.
//
// There used to be six admin-facing ways to add somebody, and none of them did the
// whole job: three made a row on the attendance board, three made an AskVic login, and
// nobody connected the two. The person who built it added two board rows thinking he was
// making accounts, which is how duplicates appear. One door now, three tick boxes.
//
// A person is up to three things, and this keeps them together:
//   1. a place on the attendance board  -- their check-in code, punches, days off, pay
//   2. an AskVic login                  -- lessons, My Week, VIC
//   3. school leader access             -- the principal dashboard
//
// Nothing here ever creates a second board row for somebody who is already on the board.

import { nameKey } from './staff-attendance.mjs'

export const STAFF_ROLES = ['teacher', 'support', 'office', 'leader', 'other']
export const LEADER_ROLES = ['principal', 'admin']

export function personInput(body) {
 const name = String(body?.name ?? '').trim().replace(/\s+/g, ' ').slice(0, 120)
 if (name.length < 2) throw new Error('Enter the person’s name.')

 const email = String(body?.email ?? '').trim().toLowerCase().slice(0, 254)
 if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('That email doesn’t look right.')

 const role = STAFF_ROLES.includes(body?.role) ? body.role : 'teacher'
 const wantsLogin = body?.wantsLogin === true
 const leader = body?.leader === true

 // Both of the extras are an email address away from impossible: a login IS an email,
 // and leader access hangs off that login.
 if ((wantsLogin || leader) && !email) throw new Error('Add their email address to give them an AskVic login.')
 if (leader && !wantsLogin) throw new Error('School leaders need an AskVic login as well.')

 const payType = body?.payType === 'hourly' ? 'hourly' : 'salaried'
 const sick = body?.sickDays
 const sickDays = sick === '' || sick == null ? null
  : Number.isFinite(Number(sick)) && Number(sick) >= 0 && Number(sick) <= 365 ? Number(sick)
  : undefined
 if (sickDays === undefined) throw new Error('Paid days off has to be a number of days.')

 return { name, email, role, wantsLogin, leader, payType, sickDays, key: nameKey(name) }
}

// Who on the board is already this person? Email first, then their name however it is
// written -- nameKey reads "Jefferson,Ruth" and "Ruth Jefferson" as the same person, which
// is what stops a second row appearing.
export function findOnBoard(staff, person) {
 const rows = (staff || []).filter(s => s.active !== false)
 if (person.email) {
  const byEmail = rows.find(s => String(s.email || '').toLowerCase() === person.email)
  if (byEmail) return { row: byEmail, matchedOn: 'email' }
 }
 const byName = rows.find(s => nameKey(s.display_name) === person.key)
 return byName ? { row: byName, matchedOn: 'name' } : null
}

// What the leader is told afterwards, so "added" never overstates what happened.
export function outcomeMessage({ boardCreated, matchedOn, loginCreated, loginExisted, leaderGranted, name }) {
 const bits = []
 bits.push(boardCreated
  ? `${name} is on your staff board.`
  : `${name} was already on your board${matchedOn === 'name' ? ' under a slightly different spelling' : ''}, so that record was used rather than a second one.`)
 if (loginCreated) bits.push('Their AskVic login is ready — they sign in with their email and request a link.')
 else if (loginExisted) bits.push('They already had an AskVic login, now linked to this record.')
 if (leaderGranted) bits.push('They can see the school dashboard.')
 return bits.join(' ')
}

// Extra addresses that reach the same account.
//
// Staff signed up with personal addresses; the school later issued
// @saintpetersacademy.org ones. Nobody should lose their week, their classes or their
// lessons because their address changed, so an account can answer to more than one.
//
// An alias grants nothing on its own. Signing in still means receiving a one-time code
// AT that address, so only someone who controls the mailbox can use it. That is what
// makes it safe for a principal to add one on a teacher's behalf.

export const tidyEmail = value =>
 typeof value === 'string' ? value.trim().toLowerCase() : ''

// The account a login address belongs to, whether it is the one they signed up with
// or an alias added later. Returns null when the address is not known.
export async function accountForEmail(admin, rawEmail, columns = 'id,role,auth_user_id,email') {
 const email = tidyEmail(rawEmail)
 if (!email) return null

 const direct = await admin.from('users').select(columns).eq('email', email)
  .order('id', { ascending: true }).limit(1).maybeSingle()
 if (direct.error) throw new Error('Account lookup failed')
 if (direct.data) return { profile: direct.data, viaAlias: false }

 const alias = await admin.from('user_email_aliases').select('user_id')
  .eq('email', email).is('retired_at', null).maybeSingle()
 if (alias.error) throw new Error('Account lookup failed')
 if (!alias.data) return null

 const owner = await admin.from('users').select(columns).eq('id', alias.data.user_id).maybeSingle()
 if (owner.error) throw new Error('Account lookup failed')
 return owner.data ? { profile: owner.data, viaAlias: true } : null
}

// Every address that currently reaches an account, newest alias last.
export async function addressesForUser(admin, userId) {
 const owner = await admin.from('users').select('email').eq('id', userId).maybeSingle()
 if (owner.error) throw new Error('Account lookup failed')
 const extra = await admin.from('user_email_aliases').select('email,created_at,source')
  .eq('user_id', userId).is('retired_at', null).order('created_at', { ascending: true })
 if (extra.error) throw new Error('Account lookup failed')
 return {
  signedUpWith: owner.data?.email || null,
  aliases: (extra.data || []).map(r => ({ email: r.email, source: r.source, since: r.created_at })),
 }
}

// Refuse an address that already reaches somebody — including the person adding it,
// so a double tap does not look like a failure.
export async function aliasBlocked(admin, email, forUserId) {
 const found = await accountForEmail(admin, email, 'id')
 if (!found) return null
 return found.profile.id === forUserId ? 'already' : 'taken'
}

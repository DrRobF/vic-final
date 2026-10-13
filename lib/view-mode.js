// School leaders can switch between the school dashboard and their own teaching.
// Stored per browser; it only decides where "home" is and which menu shows.
const MODE_KEY = 'askvic-mode', LEADER_KEY = 'askvic-leader'
function read(key) { try { return localStorage.getItem(key) } catch { return null } }
function write(key, value) { try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value) } catch {} }
export function readMode() { return read(MODE_KEY) === 'teacher' ? 'teacher' : 'school' }
export function saveMode(mode) { write(MODE_KEY, mode === 'teacher' ? 'teacher' : 'school') }
export function readLeader() { const v = read(LEADER_KEY); return v ? { leader: v.includes('l'), admin: v.includes('a') } : null }
export function rememberLeader({ leader, manageAccounts }) { write(LEADER_KEY, leader || manageAccounts ? `${leader ? 'l' : ''}${manageAccounts ? 'a' : ''}` : null) }
export function homeFor(account, mode = readMode()) {
 if (!account) return '/login'
 if (account.role === 'student') return '/learn'
 if ((account.leader || account.manageAccounts) && mode !== 'teacher') return '/school'
 return '/teach'
}

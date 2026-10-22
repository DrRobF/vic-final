// Scheduling a lesson ahead: an assignment whose assigned_at is in the future is "scheduled".
// Students only see assignments whose assigned_at has arrived, so a lesson set up on Sunday for
// Wednesday appears on Wednesday morning without anything having to run at that moment.

export const SCHOOL_TZ = 'America/New_York'
const DAY = /^\d{4}-\d{2}-\d{2}$/

// Minutes the time zone is ahead of UTC at a given instant (New York is -240 or -300).
function offsetMinutes(instant, timeZone) {
 const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(instant).map(p => [p.type, p.value]))
 const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
 return Math.round((asUtc - instant.getTime()) / 60000)
}

// Midnight at the start of a school day (YYYY-MM-DD), as a UTC ISO string. Null if the date is invalid.
export function schoolDayStart(day, timeZone = SCHOOL_TZ) {
 if (typeof day !== 'string' || !DAY.test(day)) return null
 const guess = new Date(`${day}T00:00:00Z`)
 if (Number.isNaN(guess.getTime()) || guess.toISOString().slice(0, 10) !== day) return null
 let t = guess.getTime() - offsetMinutes(guess, timeZone) * 60000
 t = guess.getTime() - offsetMinutes(new Date(t), timeZone) * 60000 // second pass settles daylight-saving edges
 return new Date(t).toISOString()
}

// Today's date (YYYY-MM-DD) in the school's time zone.
export function schoolToday(now = new Date(), timeZone = SCHOOL_TZ) {
 return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

// Supabase .or() filter: the assignment has been released (or predates scheduling and has no time).
export function releasedFilter(now = new Date()) {
 return `assigned_at.is.null,assigned_at.lte."${now.toISOString()}"`
}

// A release time a teacher may ask for: a real date, in the future, at most 30 days out.
export function validReleaseAt(value, now = new Date()) {
 if (typeof value !== 'string') return null
 const t = new Date(value)
 if (Number.isNaN(t.getTime())) return null
 if (t.getTime() <= now.getTime()) return null
 if (t.getTime() - now.getTime() > 31 * 86400000) return null
 return t.toISOString()
}

export function schoolClock(now = new Date(), timeZone = 'America/New_York') {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).filter(part => part.type !== 'literal').map(part => [part.type, part.value]))
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

export function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function mondayOf(isoDate) {
  const day = new Date(`${isoDate}T12:00:00Z`).getUTCDay()
  return addDays(isoDate, -((day + 6) % 7))
}

export function planningWeekFor(isoDate) {
  const monday = mondayOf(isoDate)
  const weekday = new Date(`${isoDate}T12:00:00Z`).getUTCDay()
  return weekday === 0 || weekday >= 5 ? addDays(monday, 7) : monday
}

export function periodFor(commitment, date) {
  return commitment.cadence === 'daily' ? date : mondayOf(date)
}

export function commitmentStatus(commitment, evidence, clock) {
  if (!commitment.enabled) return 'not assigned'
  if (evidence?.state === 'reviewed') return 'reviewed'
  if (evidence?.state === 'received') return 'received'
  const dueDate = commitment.cadence === 'daily'
    ? clock.date
    : addDays(mondayOf(clock.date), (Number(commitment.due_weekday) + 6) % 7)
  return clock.date > dueDate || (clock.date === dueDate && clock.time > commitment.due_time.slice(0, 5))
    ? 'overdue' : 'due'
}

export function appliesTo(commitment, staff) {
  return commitment.enabled && (commitment.applies_to === 'all' || staff.role === 'teacher')
}

export function safeSourceUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && url.hostname ? url.toString() : null
  } catch { return null }
}

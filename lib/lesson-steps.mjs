// The four steps every lesson moves through: Plan → Print → Teach → Follow up.
// Plan is done once the lesson exists; the other three are stamped with a date in the lesson's saved draft.
export const STEPS = [
 { key: 'plan', label: 'Plan', hint: 'Edit the lesson', path: '/lessonplan', param: 'lesson', extra: '&view=lesson' },
 { key: 'print', label: 'Print', hint: 'Packets & worksheets', path: '/lesson/print', param: 'id' },
 { key: 'teach', label: 'Teach', hint: 'Send to students', path: '/lesson/teach', param: 'id' },
 { key: 'follow', label: 'Follow up', hint: 'Families & tomorrow', path: '/lesson/follow-up', param: 'id' },
]
export const MARKABLE = ['print', 'teach', 'follow']
export function stepHref(key, lessonId) {
 const s = STEPS.find(x => x.key === key)
 return `${s.path}?${s.param}=${encodeURIComponent(lessonId)}${s.extra || ''}`
}
export function stepDone(key, steps) {
 if (key === 'plan') return true
 return Boolean(steps && typeof steps[key] === 'string' && steps[key])
}
export function doneCount(steps) { return STEPS.filter(s => stepDone(s.key, steps)).length }
// The first step not yet done, so the week view can say what's next.
export function nextStep(steps) { return STEPS.find(s => !stepDone(s.key, steps)) || null }
// Validates a change and returns the new steps object.
export function updateSteps(current, step, done, now = new Date().toISOString()) {
 if (!MARKABLE.includes(step)) throw new Error('Choose Print, Teach or Follow up.')
 const steps = current && typeof current === 'object' && !Array.isArray(current) ? { ...current } : {}
 if (done) steps[step] = steps[step] || now
 else delete steps[step]
 return Object.fromEntries(MARKABLE.filter(k => typeof steps[k] === 'string').map(k => [k, steps[k]]))
}

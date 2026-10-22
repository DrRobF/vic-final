// The lesson's schedule of activities, for the live lesson screen.
export function lessonPhases(draft) {
 const sessions = Array.isArray(draft?.plan?.sessions) ? draft.plan.sessions : []
 const phases = sessions[0]?.phases
 if (Array.isArray(phases) && phases.length) {
  return phases.map(p => ({ title: String(p.title || ''), minutes: Number(p.minutes) || 0, kind: String(p.kind || ''), teacher: String(p.teacherAction || ''), students: String(p.studentAction || ''), materials: String(p.materials || '') }))
 }
 // Older lessons: the plan's own sections, in order, without minutes.
 const skip = /^(standards|learning objectives|materials and preparation|differentiation)$/i
 return (draft?.plan?.sections || []).filter(s => s?.body && !skip.test(String(s.heading || '').trim()))
  .map(s => ({ title: String(s.heading), minutes: 0, kind: '', teacher: String(s.body), students: '', materials: '' }))
}

// VIC's verdict on a lesson or practice skill: [[VIC_GOAL: met|partly|not_yet]] on the last line.
// The tag is removed before the student sees the reply and stored in vic_goal_results.
const TAG = /\n?[ \t]*\[\[\s*VIC_GOAL\s*:\s*([a-z_ ]+?)\s*\]\][ \t]*/gi
const VERDICTS = { met: 'met', partly: 'partly', not_yet: 'not_yet', 'not yet': 'not_yet', notyet: 'not_yet' }

export function extractGoal(reply) {
 let goal = null
 const text = String(reply || '').replace(TAG, (_, v) => { if (!goal) goal = VERDICTS[String(v).toLowerCase().trim()] || null; return '' }).trim()
 return { text, goal }
}

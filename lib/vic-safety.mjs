// Student safety alerts.
//
// When a student tells VIC something that suggests they are hurt, in danger, or may hurt someone,
// the student's teacher is told. Two independent signals, so one miss is not a miss:
//
//   1. VIC's own judgment. The brain's STUDENT SAFETY section ends such a reply with
//      [[VIC_SAFETY_ALERT: category]]. That line is stripped before the student sees it.
//   2. A keyword backstop on what the student typed, in case the model does not add the marker.
//
// False alarms are acceptable here; a teacher reading one extra email costs far less than a
// missed child. Ordinary frustration ("this is killing me") is deliberately not matched.

export const SAFETY_CATEGORIES = {
  self_harm: 'Talked about hurting themselves or not wanting to live',
  harmed_by_someone: 'Said someone is hurting, threatening, or scaring them',
  danger_to_others: 'Talked about hurting someone else',
  unsafe_situation: 'Said they feel unsafe or are in danger',
}

const MARKER = /\n?[ \t]*\[\[\s*VIC_SAFETY_ALERT\s*:?\s*([a-z_]*)\s*\]\][ \t]*/gi

// Phrases a K–8 student might actually type. Each is about the child or a real person, not a game.
const KEYWORDS = [
  ['self_harm', /\b(?:kill|hurt|cut|harm|stab|shoot)(?:ing)?\s+my\s?self\b/i],
  ['self_harm', /\b(?:want|wanna|going|gonna)\s+(?:to\s+)?(?:die|be dead|end it)\b/i],
  ['self_harm', /\b(?:end|take)\s+my\s+(?:own\s+)?life\b/i],
  ['self_harm', /\bsuicid/i],
  ['self_harm', /\b(?:don'?t|do not|dont)\s+want\s+to\s+(?:be\s+alive|live|exist)\b/i],
  ['self_harm', /\bno\s+reason\s+to\s+live\b/i],
  ['harmed_by_someone', /\b(?:my\s+)?(?:mom|mother|dad|father|step\s?(?:mom|dad)|parent|uncle|aunt|brother|sister|cousin|grandpa|grandma|teacher|coach|babysitter|boyfriend|girlfriend|he|she|they|someone|somebody)\s+(?:hits|hit|beats|beat|punches|punched|kicks|kicked|chokes|choked|burns|burned|hurts|hurt|touches|touched)\s+me\b/i],
  ['harmed_by_someone', /\b(?:touched|touches)\s+me\s+(?:in\s+)?(?:a\s+)?(?:bad|weird|private|wrong)\b/i],
  ['harmed_by_someone', /\b(?:scared|afraid)\s+(?:to\s+go\s+home|of\s+my\s+(?:mom|dad|parent|step))/i],
  ['danger_to_others', /\b(?:bring|bringing|brought|have|got)\s+a\s+(?:gun|knife)\s+(?:to|at)\s+school\b/i],
  ['danger_to_others', /\b(?:going\s+to|gonna|want\s+to|wanna)\s+(?:kill|shoot|stab)\s+(?:him|her|them|everyone|everybody|someone|my\s+(?:teacher|mom|dad|brother|sister|classmate|friend)|my\s?self)\b/i],
  ['unsafe_situation', /\b(?:nobody|no\s*one)\s+(?:feeds|takes\s+care\s+of)\s+me\b/i],
  ['unsafe_situation', /\bi(?:'m|\s+am)\s+not\s+safe\b/i],
]

export function screenStudentMessage(text) {
  const value = typeof text === 'string' ? text : ''
  for (const [category, pattern] of KEYWORDS) if (pattern.test(value)) return category
  return ''
}

// Removes every marker from VIC's reply and reports the first category found.
export function extractSafetyMarker(reply) {
  const value = typeof reply === 'string' ? reply : ''
  let category = ''
  const clean = value.replace(MARKER, (_, found) => {
    if (!category) category = Object.hasOwn(SAFETY_CATEGORIES, found?.toLowerCase()) ? found.toLowerCase() : 'unsafe_situation'
    return ''
  }).trim()
  return { reply: clean, category }
}

export function detectSafety({ studentText, reply }) {
  const marked = extractSafetyMarker(reply)
  const keyword = screenStudentMessage(studentText)
  const category = marked.category || keyword
  return { reply: marked.reply, category, source: marked.category ? (keyword ? 'vic+keywords' : 'vic') : keyword ? 'keywords' : '' }
}

export function safetyEmail({ studentName, className, category, studentText, vicReply, at }) {
  const when = new Date(at || Date.now()).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short' })
  return {
    subject: `Please check on ${studentName || 'a student'} — VIC safety alert`,
    body: [
      `${studentName || 'One of your students'} said something to VIC that may mean they need an adult's help.`,
      '',
      `Concern: ${SAFETY_CATEGORIES[category] || SAFETY_CATEGORIES.unsafe_situation}`,
      `Class: ${className || 'Not in a class session'}`,
      `When: ${when} (Eastern)`,
      '',
      'What the student wrote:',
      `"${String(studentText || '').slice(0, 1500)}"`,
      '',
      'What VIC replied:',
      String(vicReply || '').slice(0, 1500),
      '',
      'Please check on this student today and follow your school’s reporting procedures.',
      'VIC told the student their teacher would be told, and encouraged them to talk to a trusted adult.',
      '',
      'This alert may be a false alarm: VIC flags anything that could mean a child is unsafe.',
      'VIC does not replace your school’s counselor, administrators, or mandated-reporting duties.',
    ].join('\n'),
  }
}
